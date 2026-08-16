const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// In-memory team store: { teamName: { description, restriction, admin, members: [] } }
const teams = {};

// Strike tracking: { "teamName_user": { count, timeoutUntil } }
const userStrikes = {};

// Gemini Setup
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
// REST: Create Team
app.post('/api/teams/create', (req, res) => {
    const { teamName, description, restriction, admin, password } = req.body;
    if (!teamName || !description || !admin) {
        return res.status(400).json({ error: "teamName, description, and admin are required." });
    }
    if (teams[teamName]) {
        return res.status(409).json({ error: "Team name already taken." });
    }
    teams[teamName] = { description, restriction: restriction || "No personal attacks or off-topic content.", admin, password: password || null, members: [] };
    res.json({ success: true, team: teams[teamName] });
});

// REST: Join Team (validate)
app.post('/api/teams/join', (req, res) => {
    const { teamName, password } = req.body;
    const team = teams[teamName];
    if (!team) return res.status(404).json({ error: "Team not found." });
    if (team.password && team.password !== password) return res.status(403).json({ error: "Incorrect password." });
    res.json({ success: true, team });
});

// REST: List Teams
app.get('/api/teams', (req, res) => {
    const list = Object.entries(teams).map(([name, t]) => ({
        name,
        description: t.description,
        admin: t.admin,
        memberCount: t.members.length,
        hasPassword: !!t.password,
    }));
    res.json(list);
});

// Moderate message with Gemini
async function moderateMessage(teamName, text, description, restriction) {
    const prompt = `You are a strict topic moderator for a team called "${teamName}".
Team Focus: "${description}"
Rules: "${restriction}"

Is the following message relevant to the team's focus/topic? 
Respond with ONLY one word: YES or NO.
Message: "${text}"`;

    const result = await model.generateContent(prompt);
    const answer = result.response.text().trim().toUpperCase();
    return answer.startsWith("YES");
}

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Join a team room — auto-create team data if REST already validated it
    socket.on('join_team', ({ teamName, user, teamInfo }) => {
        // If team doesn't exist in memory yet (e.g. page refresh), recreate from teamInfo
        if (!teams[teamName] && teamInfo) {
            teams[teamName] = {
                description: teamInfo.description,
                restriction: teamInfo.restriction || "Stay on topic.",
                admin: teamInfo.admin,
                password: teamInfo.password || null,
                members: []
            };
            console.log(`[auto-restored] team "${teamName}" from client info`);
        }

        const team = teams[teamName];
        if (!team) {
            socket.emit('error_message', "Team not found. Please go back and re-join.");
            console.error(`join_team failed: team "${teamName}" not found`);
            return;
        }

        socket.join(teamName);
        socket.data = { teamName, user };
        console.log(`[join] ${user} → room "${teamName}"`);

        if (!team.members.includes(user)) team.members.push(user);

        io.to(teamName).emit('receive_message', {
            user: 'System',
            text: `${user} joined the space.`,
            type: 'notification',
            time: now()
        });

        io.to(teamName).emit('members_update', [...team.members]);

        const key = `${teamName}_${user}`;
        if (userStrikes[key]) {
            socket.emit('strike_status', userStrikes[key]);
        }
    });

    // Send message with Gemini moderation
    socket.on('send_message', async ({ teamName, user, text }) => {
        console.log(`[msg] "${text}" from ${user} in "${teamName}"`);
        const team = teams[teamName];
        if (!team) {
            socket.emit('error_message', "Room not found. Please rejoin.");
            console.error(`send_message: team "${teamName}" missing`);
            return;
        }

        const key = `${teamName}_${user}`;
        if (!userStrikes[key]) userStrikes[key] = { count: 0, timeoutUntil: null };

        const strikes = userStrikes[key];

        // Check if frozen
        if (strikes.timeoutUntil && strikes.timeoutUntil > Date.now()) {
            const remaining = Math.ceil((strikes.timeoutUntil - Date.now()) / 1000 / 60 / 60);
            socket.emit('error_message', `🧊 Your chat is frozen for ${remaining} more hour(s) due to 3 off-topic strikes.`);
            return;
        }

        // Reset timeout if it's expired
        if (strikes.timeoutUntil && strikes.timeoutUntil <= Date.now()) {
            strikes.count = 0;
            strikes.timeoutUntil = null;
        }

        let isRelevant = true;
        try {
            isRelevant = await moderateMessage(teamName, text, team.description, team.restriction);
        } catch (err) {
            console.error("Gemini error:", err.message);
            // Fallback: allow message if AI is down
        }

        if (!isRelevant) {
            strikes.count += 1;
            socket.emit('strike_update', { count: strikes.count, max: 3 });

            if (strikes.count >= 3) {
                strikes.timeoutUntil = Date.now() + 24 * 60 * 60 * 1000;
                socket.emit('strike_status', strikes);
                io.to(teamName).emit('receive_message', {
                    user: 'System',
                    text: `🧊 ${user} has been frozen for 24 hours after 3 off-topic messages.`,
                    type: 'notification',
                    time: now()
                });
            } else {
                socket.emit('receive_message', {
                    user: 'System',
                    text: `⚠️ Off-topic! Strike ${strikes.count}/3. Stay focused on: "${team.description}"`,
                    type: 'warning',
                    time: now()
                });
            }
            return;
        }

        io.to(teamName).emit('receive_message', {
            user,
            text,
            type: 'message',
            time: now()
        });
    });

    // Admin kick user
    socket.on('kick_user', ({ teamName, userToKick, adminUser }) => {
        const team = teams[teamName];
        if (!team || team.admin !== adminUser) return;
        team.members = team.members.filter(m => m !== userToKick);
        io.to(teamName).emit('user_kicked', { userToKick });
        io.to(teamName).emit('members_update', team.members);
        io.to(teamName).emit('receive_message', {
            user: 'System',
            text: `${userToKick} was removed by the admin.`,
            type: 'notification',
            time: now()
        });
    });

    // Admin reset strikes
    socket.on('reset_strikes', ({ teamName, targetUser, adminUser }) => {
        const team = teams[teamName];
        if (!team || team.admin !== adminUser) return;
        const key = `${teamName}_${targetUser}`;
        userStrikes[key] = { count: 0, timeoutUntil: null };
        io.to(teamName).emit('receive_message', {
            user: 'System',
            text: `✅ ${targetUser}'s strikes have been reset by admin.`,
            type: 'notification',
            time: now()
        });
    });

    socket.on('disconnect', () => {
        const { teamName, user } = socket.data || {};
        if (teamName && user && teams[teamName]) {
            teams[teamName].members = teams[teamName].members.filter(m => m !== user);
            io.to(teamName).emit('members_update', teams[teamName].members);
            io.to(teamName).emit('receive_message', {
                user: 'System',
                text: `${user} left the space.`,
                type: 'notification',
                time: now()
            });
        }
        console.log('Socket disconnected:', socket.id);
    });
});

function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

server.listen(5000, () => console.log('🚀 Focused Chat Server running on port 5000'));
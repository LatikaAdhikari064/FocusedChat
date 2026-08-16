const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } }); // In production, replace * with your frontend URL

app.use(cors());
app.use(express.json());

// --- IN-MEMORY DATABASE ---
const groups = {};       // { groupName: { description, password, isPrivate, creatorEmail, isLocked: false, members: [] } }
const userStrikes = {}; // { "groupName_username": { count: 0, timeoutUntil: null } }

// --- GEMINI AI CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

// Core AI Moderation Logic
async function checkContentOffTopic(groupDescription, textContent) {
    const prompt = `You are a zero-tolerance topic moderator for a chat group.
Group Focus/Topic: "${groupDescription}"

Analyze this user message: "${textContent}"
Is this message completely off-topic or irrelevant to the group focus? 
Respond with EXACTLY one word: YES or NO.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim().toUpperCase();
        return responseText.includes("YES");
    } catch (error) {
        console.error("AI Error (falling back to allowing message):", error.message);
        return false; 
    }
}

// --- HTTP REST ENDPOINTS ---

// 1. Create a Space
app.post('/api/groups/create', (req, res) => {
    const { groupName, description, password, isPrivate, email } = req.body;

    if (!groupName || !description || !email) {
        return res.status(400).json({ error: "Group name, description, and creator email are required." });
    }
    if (groups[groupName]) {
        return res.status(409).json({ error: "A space with this name already exists." });
    }

    groups[groupName] = {
        name: groupName,
        description,
        password: password || null,
        isPrivate: !!isPrivate,
        creatorEmail: email,
        isLocked: false,
        members: []
    };

    res.status(201).json({ success: true, group: groups[groupName] });
});

// 2. Join Validation Endpoint
app.post('/api/groups/validate-join', (req, res) => {
    const { groupName, password } = req.body;
    const group = groups[groupName];

    if (!group) return res.status(404).json({ error: "Space not found." });
    if (group.isLocked) return res.status(403).json({ error: "This space is locked by the admin. No new entries allowed." });
    if (group.password && group.password !== password) {
        return res.status(401).json({ error: "Incorrect password." });
    }

    res.json({ success: true, message: "Access granted." });
});

// --- REAL-TIME WEBSOCKET LOGIC (Socket.io) ---
io.on('connection', (socket) => {

    // Action: User enters the space
    socket.on('join_space', ({ groupName, username }) => {
        const group = groups[groupName];
        if (!group) return socket.emit('error_alert', "Space does not exist.");
        if (group.isLocked) return socket.emit('error_alert', "This space is locked.");

        socket.join(groupName);
        socket.data = { groupName, username }; // Save session to socket instance

        if (!group.members.includes(username)) {
            group.members.push(username);
        }

        // Broadcast updates to the room
        io.to(groupName).emit('sys_message', `${username} joined the space.`);
        io.to(groupName).emit('members_updated', group.members);
        socket.emit('meta_updated', group); // Send initial group metadata (description, lock status)
    });

    // Action: Send Message (Text/Media metadata)
    socket.on('send_msg', async ({ groupName, username, messageData }) => {
        const group = groups[groupName];
        if (!group) return;

        const strikeKey = `${groupName}_${username}`;
        if (!userStrikes[strikeKey]) userStrikes[strikeKey] = { count: 0, timeoutUntil: null };
        const strikes = userStrikes[strikeKey];

        // 1. Check Freeze Status
        if (strikes.timeoutUntil && strikes.timeoutUntil > Date.now()) {
            const minsLeft = Math.ceil((strikes.timeoutUntil - Date.now()) / 60000);
            return socket.emit('error_alert', `Your chat is frozen for ${minsLeft} more minutes due to off-topic strikes.`);
        }

        // 2. Clear expired freeze
        if (strikes.timeoutUntil && strikes.timeoutUntil <= Date.now()) {
            strikes.count = 0;
            strikes.timeoutUntil = null;
        }

        // 3. AI Moderation Check (Triggered for text content)
        if (messageData.text) {
            const isOffTopic = await checkContentOffTopic(group.description, messageData.text);

            if (isOffTopic) {
                strikes.count++;

                if (strikes.count === 3) {
                    // 3rd Strike: 24-Hour Freeze
                    strikes.timeoutUntil = Date.now() + 24 * 60 * 60 * 1000;
                    io.to(groupName).emit('sys_message', `🧊 ${username} has been frozen for 24 hours after 3 off-topic warnings.`);
                    socket.emit('strike_alert', { strikes: 3 });
                } else if (strikes.count >= 4) {
                    // 4th Strike: Automatic Group Eviction
                    group.members = group.members.filter(m => m !== username);
                    socket.emit('evicted', "You have been permanently removed from the group for repeated off-topic violations.");
                    io.to(groupName).emit('sys_message', `❌ ${username} was automatically removed from the space for hitting 4 off-topic strikes.`);
                    io.to(groupName).emit('members_updated', group.members);
                } else {
                    // 1st or 2nd Strike: Warning
                    socket.emit('strike_alert', { strikes: strikes.count });
                    socket.emit('sys_message', `⚠️ Warning: Stay on topic! Strike ${strikes.count}/3. (Next strike freezes chat, 4th kicks you).`);
                }
                return; // Stop the message from broadcasting
            }
        }

        // 4. If clean or media file metadata, broadcast to room
        io.to(groupName).emit('receive_msg', {
            id: Math.random().toString(36).substring(7),
            username,
            text: messageData.text || null,
            mediaUrl: messageData.mediaUrl || null, // URL from your front-end file-upload strategy
            mediaType: messageData.mediaType || null, // 'image' or 'audio'
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // Action: Admin Head Touch controls (Lock space entries)
    socket.on('toggle_lock_space', ({ groupName, email }) => {
        const group = groups[groupName];
        if (!group || group.creatorEmail !== email) return;

        group.isLocked = !group.isLocked;
        io.to(groupName).emit('meta_updated', group);
        io.to(groupName).emit('sys_message', `Space entry has been ${group.isLocked ? 'LOCKED' : 'UNLOCKED'} by the admin.`);
    });

    // Action: Admin Head Touch controls (Delete Group)
    socket.on('delete_space', ({ groupName, email }) => {
        const group = groups[groupName];
        if (!group || group.creatorEmail !== email) return;

        io.to(groupName).emit('group_deleted', "This space has been deleted by the admin.");
        delete groups[groupName];
    });

    // Action: Disconnect cleanup
    socket.on('disconnect', () => {
        const { groupName, username } = socket.data || {};
        if (groupName && groups[groupName]) {
            groups[groupName].members = groups[groupName].members.filter(m => m !== username);
            io.to(groupName).emit('members_updated', groups[groupName].members);
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 FocusChat Engine active on port ${PORT}`));
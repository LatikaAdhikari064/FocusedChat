const Team = require('../models/Team'); // Your Mongoose Model

exports.createTeam = async (req, res) => {
    try {
        const { teamName, adminName, password, description, restriction } = req.body;
        
        const existing = await Team.findOne({ teamName });
        if (existing) return res.status(400).json({ message: "Team name taken" });

        const newTeam = await Team.create({
            teamName,
            admin: adminName,
            password,
            description,
            restriction,
            members: [adminName]
        });

        res.status(201).json({ teamName, user: adminName, info: newTeam });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};

exports.joinTeam = async (req, res) => {
    try {
        const { teamName, username, password } = req.body;
        const team = await Team.findOne({ teamName });

        if (!team || team.password !== password) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Add member if not exists
        if (!team.members.includes(username)) {
            team.members.push(username);
            await team.save();
        }

        res.status(200).json({ teamName, user: username, info: team });
    } catch (err) {
        res.status(500).json({ message: "Join failed" });
    }
};
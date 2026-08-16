const mongoose = require("mongoose");

const TeamSchema = new mongoose.Schema({
  adminName: String,
  groupName: { type: String, unique: true, required: true }, // Unique ID for the team
  email: String,
  password: { type: String, required: true }, // Will be hashed
  description: String,
  topicRestriction: String,
  members: [{ username: String }] 
});

module.exports = mongoose.model("Team", TeamSchema);
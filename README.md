# FocusChat

An AI-moderated real-time chat platform designed to keep group conversations focused on their intended topic.

##Live Demo

https://focused-chat.vercel.app/

## 📌 Overview

FocusChat is a real-time chat application where users can create or join topic-focused chat spaces.

The main idea is to solve a common problem in group communication: conversations gradually drifting away from the purpose of the group.

Each space has a defined topic, and messages are checked using Google's Gemini API. If a message is detected as off-topic, the user receives a strike. After three strikes, the user's chat is temporarily frozen for 24 hours.

The application also supports real-time member updates, group administration, private spaces, and real-time messaging using Socket.IO.

## Features

- Create topic-focused chat spaces
- Join existing chat spaces
- Public and password-protected spaces
- Define a topic/description for every space
- AI-based message moderation using Gemini
- Off-topic message detection
- Strike-based moderation system
- 3 strikes → 24-hour chat freeze
- Real-time messaging using Socket.IO
- Real-time member list updates
- Join/leave system notifications
- Admin controls
  - Lock/unlock new entries
  - Remove users
  - Delete a space
  - Reset user strikes
- Responsive chat interface
- Connection status indicator
- Automatic message scrolling
- Freeze countdown timer

## AI Moderation

FocusChat uses Google's Gemini API to determine whether a text message is relevant to the topic of a chat space.

The backend sends the group topic and user's message to the Gemini model.

Simplified flow:

```text
User sends message
        ↓
Backend receives message
        ↓
Gemini checks message against group topic
        ↓
     ┌───────────────┐
     │   On Topic?   │
     └───────────────┘
        ↓          ↓
      YES          NO
       ↓            ↓
 Broadcast       Strike
 message           ↓
              3 strikes
                   ↓
             24h freeze

<img width="1567" height="765" alt="image" src="https://github.com/user-attachments/assets/23ee073f-3b3f-49b6-b438-a4049f4b1017" />

# EduCast

> A real-time virtual classroom platform with low-latency video streaming, live chat, attendance management, and video-on-demand capabilities.

EduCast is a full-stack virtual classroom platform designed for real-time online teaching. It combines **WebRTC** for low-latency peer-to-peer audio/video communication with **Socket.IO** for signaling, room management, and persistent live chat.

The platform is built with a **React frontend**, **Node.js/Express backend**, and **Prisma ORM**, with the architecture designed to separate the real-time media layer from the application's control and data layers.

---

## ✨ Features

- 🎥 **Real-time video & audio** using WebRTC
- 💬 **Live classroom chat** using Socket.IO
- 📝 **Persistent chat history** backed by a database
- 👨‍🏫 **Instructor-led virtual classrooms**
- 👨‍🎓 **Student room discovery and joining**
- 📊 **Attendance management**
- 📺 **Video-on-demand (VOD) support**
- 🔐 **Authenticated classroom communication**
- ⚡ **Low-latency peer-to-peer media**
- 🛡️ **Graceful handling of instructor disconnections**
- 🔊 **Browser autoplay-policy fallback**
- 🐳 **Dockerized deployment**

---

## 🏗️ Architecture

EduCast separates the **media plane** from the **signaling and application plane**.

```text
                    ┌──────────────────────┐
                    │       React UI       │
                    │                      │
                    │  Classroom / Chat    │
                    │  Video / Attendance  │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
        ┌─────────────────┐        ┌─────────────────┐
        │    WebRTC       │        │    Socket.IO    │
        │                 │        │                 │
        │ Audio / Video   │        │ Signaling       │
        │ Media Plane     │        │ Chat / Rooms    │
        └────────┬────────┘        └────────┬────────┘
                 │                          │
                 │ P2P                      ▼
                 │                  ┌─────────────────┐
                 │                  │ Node / Express  │
                 │                  │                 │
                 │                  │ Application API │
                 │                  └────────┬────────┘
                 │                           │
                 │                           ▼
                 │                  ┌─────────────────┐
                 │                  │     Prisma      │
                 │                  │      ORM        │
                 │                  └────────┬────────┘
                 │                           │
                 │                           ▼
                 │                  ┌─────────────────┐
                 │                  │    Database     │
                 │                  │                 │
                 │                  │ Chat / Users /  │
                 │                  │ Classroom Data  │
                 │                  └─────────────────┘
                 │
                 ▼
          ┌───────────────┐
          │ STUN Servers  │
          │               │
          │ NAT Traversal │
          └───────────────┘
```

---

## 🎥 Real-Time Video & Audio

The media plane is implemented using **WebRTC**.

Rather than routing classroom video through the application server, EduCast establishes a direct connection between the instructor and students' browsers.

### Connection Establishment

When a student joins a classroom:

1. The instructor creates an **SDP Offer**.
2. The offer describes the supported media configuration, including audio/video codecs and connection parameters.
3. The student receives the offer and generates an **SDP Answer**.
4. Both peers gather **ICE candidates**.
5. STUN is used to discover the public-facing IP address and port of each peer.
6. ICE candidates are exchanged through the signaling layer.
7. WebRTC selects a viable network path and establishes the media connection.
8. Audio and video can then flow directly between peers.

```text
Instructor Browser
       │
       │ SDP Offer
       ▼
    Socket.IO
       │
       │
       ▼
 Student Browser
       │
       │ SDP Answer
       ▼
    Socket.IO

       │
       │ ICE Candidates
       ▼

┌───────────────────────────────┐
│       WebRTC Connection       │
│                               │
│   Instructor ◄────────────► Student
│              Audio/Video      │
└───────────────────────────────┘
```

### Why WebRTC?

WebRTC is well suited for real-time classroom communication because it provides:

- Low-latency audio/video
- Browser-native media transport
- Peer-to-peer communication
- NAT traversal through ICE/STUN
- Built-in support for common audio/video codecs

---

## 💬 Signaling & Live Chat

WebRTC handles the actual media transport, but it does **not** define how peers initially discover each other or exchange connection information.

EduCast uses **Socket.IO** as the signaling layer.

Socket.IO is responsible for:

- Classroom discovery
- Authenticated room communication
- WebRTC SDP offer/answer exchange
- ICE candidate exchange
- Real-time chat
- Classroom presence/events

### Why not use WebRTC DataChannels for chat?

We deliberately keep chat outside the WebRTC media layer.

Chat messages are persisted in the database through the backend, which provides two important advantages:

### 1. Persistent message history

A student joining a classroom late can retrieve messages that were sent before they joined.

```text
Student joins at 10:30
        │
        ▼
Fetch previous messages
        │
        ▼
Database
        │
        ▼
Display chat history
```

### 2. Avoiding mesh-based chat

A pure WebRTC mesh architecture can require every participant to maintain connections with every other participant.

For `N` participants, this can result in:

```text
N × (N - 1)
```

peer relationships.

Instead, EduCast routes chat through the Socket.IO server and persists it in the database.

```text
Student A ──┐
Student B ──┼──► Socket.IO ──► Backend ──► Database
Student C ──┤
Student D ──┘
```

This keeps chat management centralized while allowing the media plane to remain optimized for real-time communication.

---

## 🛡️ Production Resilience

Real-time applications need to account for browser refreshes, network interruptions, and browser security policies.

EduCast includes several mechanisms to handle these cases gracefully.

### Instructor Refresh Grace Period

The instructor is the primary source of the classroom media stream. A page refresh should therefore not immediately terminate the lecture for everyone.

EduCast implements a **15-second grace period** when the instructor disconnects.

```text
Instructor disconnects
        │
        ▼
  Start 15s timer
        │
   ┌────┴────┐
   │         │
Reconnect   Timeout
   │         │
   ▼         ▼
Restore    Close
session    classroom
```

If the instructor reconnects within the grace period, the classroom can continue without treating the temporary disconnect as a permanent session termination.

### Browser Autoplay Fallback

Modern browsers restrict automatic playback of media containing audio.

As a result, a remote video stream may fail to start with audio immediately after a student joins.

EduCast handles this by providing an autoplay fallback:

```text
Remote stream received
        │
        ▼
Attempt autoplay
        │
   ┌────┴────┐
   │         │
Success    Blocked
   │         │
   ▼         ▼
Play       Mute video
normally   and continue
```

If the browser blocks autoplay, the remote video is muted so that playback can still begin, while the user can subsequently enable audio through an explicit interaction.

---

## 🧩 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend | Node.js |
| API | Express.js |
| Real-time Signaling | Socket.IO |
| Video / Audio | WebRTC |
| NAT Traversal | STUN / ICE |
| ORM | Prisma |
| Database | SQL database |
| Containerization | Docker |

---

## 📂 Project Structure

```text
EduCast/
│
├── client/                 # React frontend
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── ...
│
├── server/                 # Node.js / Express backend
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── socket/
│   └── ...
│
├── prisma/
│   └── schema.prisma       # Database schema
│
├── Dockerfile
├── package.json
└── README.md
```

> Adjust the structure above to match the actual repository structure.

---

## 🔄 Real-Time Communication Flow

A simplified classroom lifecycle looks like this:

```text
┌──────────────┐
│  Instructor  │
└──────┬───────┘
       │
       │ Create Classroom
       ▼
┌──────────────────┐
│  Express Server  │
└────────┬─────────┘
         │
         ▼
     Database
         │
         │
         ▼
┌──────────────────┐
│    Socket.IO     │
│ Signaling Layer  │
└────────┬─────────┘
         │
         │ SDP / ICE
         ▼
┌──────────────────┐
│  Student Browser │
└────────┬─────────┘
         │
         │
    WebRTC P2P
         │
         ▼
┌──────────────────┐
│ Instructor Media │
│      Stream      │
└──────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- Docker (optional)
- A supported modern browser

### Clone the Repository

```bash
git clone https://github.com/vnesh05/EduCast.git
cd EduCast
```

### Install Dependencies

Install dependencies for the frontend and backend according to the project's directory structure.

```bash
npm install
```

### Environment Variables

Create the appropriate `.env` files and configure:

```env
DATABASE_URL="your-database-url"
```

Add any additional authentication, Socket.IO, or deployment-specific variables required by the application.

### Database Setup

Run Prisma migrations:

```bash
npx prisma migrate dev
```

Generate the Prisma client:

```bash
npx prisma generate
```

### Run the Application

Start the development server using the project's configured scripts:

```bash
npm run dev
```

---

## 🐳 Docker

EduCast can also be containerized using Docker.

```bash
docker build -t educast .
```

Run the container:

```bash
docker run -p 3000:3000 educast
```

Configure the required environment variables before deploying.

---

## 🔐 Design Considerations

### Media Plane vs. Signaling Plane

EduCast intentionally separates the two:

**Media Plane**

- WebRTC
- Audio/video
- Low latency
- Peer-to-peer communication

**Signaling/Application Plane**

- Socket.IO
- SDP/ICE exchange
- Room discovery
- Chat
- Authentication
- Persistent application state

This separation allows each technology to solve the problem it is best suited for.

### Why not send video through Node.js?

Routing raw classroom video through the Express server would make the backend responsible for high-bandwidth media traffic.

Using WebRTC allows the application server to focus on signaling and application logic while the browsers handle media transport.

---

## 📌 Current Limitations

The current architecture uses a peer-to-peer model for real-time media. As the number of participants increases, maintaining multiple media connections can become increasingly expensive for clients.

For larger classrooms, a production-scale deployment could evolve toward an **SFU (Selective Forwarding Unit)** architecture.

Possible future improvements include:

- SFU-based media routing
- TURN server support for restrictive NATs
- Recording
- Improved reconnection handling

---

## 🎯 Project Goals

EduCast was designed around three primary goals:

1. **Low-latency communication**  
   Use WebRTC to provide responsive real-time audio/video.

2. **Reliable classroom coordination**  
   Use Socket.IO and a persistent backend for signaling, chat, room management, and application state.

3. **Practical browser resilience**  
   Handle real-world issues such as instructor refreshes, temporary disconnections, and browser autoplay restrictions.

---

## 👥 Contributors

Developed as a full-stack software engineering project.

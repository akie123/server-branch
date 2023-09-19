require('dotenv').config();
// Required modules and packages
const express = require('express');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const cors = require('cors');
const http = require('http');
const app = express();
const server = http.createServer(app);
const mongoose = require("mongoose");
const Message = require('./models/message');

// Keywords for message priority categorization
const urgentKeywords = ['urgent', 'asap', 'immediately', 'need cash', 'emergency', 'now', 'fast', 'quick'];
const moderateKeywords = ['soon', 'quickly', 'please', 'kindly', 'next week', 'tomorrow'];

// Data structures for tracking agents and message assignment
const agents = new Map(); // Map to track online agents and their socket IDs
let agentQueue = []; // Circular queue of available agents
const PORT = process.env.PORT || 5000;
// Set up CORS middleware
app.use(cors());

// Set up Socket.IO with CORS
const io = socketIo(server, {
    cors: {
        origin: '*',
    }
});

// Use body-parser middleware for JSON and URL-encoded requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:  false }));

// Middleware to check for valid body format
app.use(express.json({ limit: "2mb" }), (err, req, res, next) => {
    if (err) res.sendStatus(400);
    else next();
});

// Connect to MongoDB database
mongoose.set("strictQuery", true);
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        // Start the server after successful database connection
        server.listen(PORT, () => {
            console.log(`Server Running on http://localhost:${PORT}`);
        });
    });

// Helper function to get the next agent ID in round-robin fashion
function getNextAgentId() {
    if (agentQueue.length === 0) return null;

    const nextAgentId = agentQueue[0]; // Get the first agent ID

    // Rotate the array by moving the first element to the end
    agentQueue.push(agentQueue.shift());

    return nextAgentId;
}

// Function to assign unassigned messages to available agents
async function assignUnassignedMessages() {
    try {
        // Find all unassigned messages in MongoDB
        const unassignedMessages = await Message.find({ isAssigned: false });

        if (unassignedMessages.length > 0) {
            // Loop through each unassigned message
            for (const message of unassignedMessages) {
                const nextAgentId = getNextAgentId(); // Get the next agent ID in round-robin fashion

                if (nextAgentId) {
                    message.isAssigned = true;
                    message.agentId = nextAgentId;
                    await message.save(); // Update the message in the database

                    // Emit a messageAssigned event to the agent with the assigned message
                    io.to(agents.get(nextAgentId)).emit('messageAssigned', message);
                    console.log(`Assigned message ${message._id} to Agent ${nextAgentId}`);
                }
            }
        }
    } catch (error) {
        console.error('Error assigning unassigned messages:', error);
    }
}

// Socket.IO event handling for agent connections and disconnections
io.on('connection', (socket) => {
    socket.on("agentOnline", async (agentId) => {
        console.log(`Agent ${agentId} connected`);
        agents.set(agentId, socket.id);
        if (agentQueue.indexOf(agentId) === -1) {
            agentQueue.push(agentId);
        }
        console.log(agentQueue);
        await assignUnassignedMessages();
    });

    socket.on('disconnect', () => {
        console.log(`Agent ${socket.id} disconnected`);
        // Find agent id from socket id
        let agentId = null;
        agents.forEach((value, key) => {
            if (value === socket.id) {
                agentId = key;
            }
        });
        const index = agentQueue.indexOf(agentId);
        if (index > -1) {
            agentQueue.splice(index, 1);
        }
    });
});

// API route to get messages for a specific agent
app.get('/getMessages/:agentId', async (req, res) => {
    const agentId = req.params.agentId;
    Message.find({ agentId: agentId, isResolved: false }).then((messages) => {
        res.status(200).json({
            messages: messages
        });
    }).catch((err) => {
        res.status(400).json({
            error: err
        });
    });
});

// API route to send a response to a message
app.post('/response', async (req, res) => {
    const messageId = req.body.messageId;
    const response = req.body.response;
    Message.findByIdAndUpdate(messageId, { response: { message: response }, isResolved: true }).then((message) => {
        console.log(message);
        res.status(200).json({
            message: "Response sent successfully"
        });
    }).catch((err) => {
        console.log(err);
        res.status(400).json({
            error: err
        });
    });
});

// Function to categorize message based on keywords for priority
function categorizeMessage(message) {
    const lowerCaseMessage = message.toLowerCase();

    // Check for urgent keywords
    for (const keyword of urgentKeywords) {
        if (lowerCaseMessage.includes(keyword)) {
            return '1';
        }
    }

    // Check for moderate keywords
    for (const keyword of moderateKeywords) {
        if (lowerCaseMessage.includes(keyword)) {
            return '2';
        }
    }

    // Default to not moderate if no keywords match
    return '3';
}

// API route to send a new message
app.post('/message', async (req, res) => {
    const priority = categorizeMessage(req.body.message);
    const newMsg = new Message({
        message: req.body.message,
        senderId: req.body.senderId,
        priority: priority,
    });
    await newMsg.save();
    await assignUnassignedMessages();
    res.status(200).json({
        message: "Message sent successfully",
    });
});

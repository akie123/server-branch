
const express = require('express');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const cors = require('cors');
const http = require('http');
const redis = require('redis');
const app = express();
const server = http.createServer(app);
const redisClient = redis.createClient();
const PORT = process.env.PORT || 5000;
const Message = require('./models/message');
const Agent = require('./models/agent');
const mongoose = require("mongoose");
const agent = require('./models/agent');
const agents = new Map(); // Map to track online agents and their socket IDs
let agentQueue = []; // Circular queue of available agents
app.use(cors());
const io = socketIo(server, {
    cors: {
        origin: '*',
    }
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:  false }));
app.use(express.json({ limit: "2mb" }), (err, req, res, next) => {
    // bodyparse middle ware checks for valid body format
    if (err) res.sendStatus(400);
    else next();
    });

// Connection to Database

mongoose.set("strictQuery", true);
mongoose.connect("mongodb+srv://aalhad:aalhad123@aalhad123.2dfdc.mongodb.net/Branch_task?retryWrites=true&w=majority", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
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
  // Function to get the socket ID of an agent given their agent ID
  function socketByAgentId(agentId) {
    for (const [socketId, id] of agents) {
      if (id === agentId) {
        return socketId;
      }
    }
    return null;
  }
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
            io.to(socketByAgentId(nextAgentId)).emit('messageAssigned', message);
            console.log(`Assigned message ${message._id} to Agent ${nextAgentId}`);
          }
        }
      }
    } catch (error) {
      console.error('Error assigning unassigned messages:', error);
    }
  }
  
io.on('connection', (socket) => {
    
    socket.on("agentOnline", async (agentId) => {
        console.log(`Agent ${agentId} connected`);
       agents.set(agentId, socket.id);
       if(agentQueue.indexOf(agentId) === -1)
       agentQueue.push(agentId);

       console.log(agentQueue)

       await assignUnassignedMessages();

    })
    socket.on('disconnect', () => {
        console.log(`Agent ${socket.id} disconnected`);
       // find agent id from socket id
        let agentId = null;
        agents.forEach((value, key) => {
            if(value === socket.id){
                agentId = key;
            }
        })
        const index = agentQueue.indexOf(agentId);
        if(index > -1){
        agentQueue.splice(index, 1);
        }
    });
})
app.get('/getMessages/:agentId', async (req, res) => {
    const agentId = req.params.agentId;
    Message.find({agentId: agentId,isResolved:false}).then((messages) => {
        res.status(200).json({
            messages: messages
        })
    }).catch((err) => {
        res.status(400).json({
            error: err
        })
    }
    )
})
app.post('/message', async (req, res) => {
    const newMsg = new Message({
        message:req.body.message,
        senderId:req.body.senderId,
    })
    await newMsg.save();
    await assignUnassignedMessages();
    res.status(200).json({
        message: "Message sent successfully",
    });

})






const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    senderId: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    agentId: {
        type: String
    },
    isAssigned: {
        type: Boolean,
        default: false
    },
    response: {
        type: new Schema({
            message: {
                type: String,
            }
        }, {timestamps: true}),
    },
    isResolved: {
        type: Boolean,
        default: false
    }
}, {timestamps: true});

module.exports = mongoose.model('Message', messageSchema);

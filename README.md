

## Installation


```shell
# To install depedency
npm install 
# To run server
node app
```
## API Routes

The server provides the following API routes for interacting with the application.

### Get Messages for a Specific Agent

Retrieve messages for a specific agent by providing their agent ID.

**Route:** `GET /getMessages/:agentId`

**Parameters:**
- `:agentId` (string): The ID of the agent you want to retrieve messages for.

**Example Request:**

```http
GET /getMessages/agent123
```
### Send a Response to a Message

To send a response to a specific message, you can use the following API route:

**Route:** `POST /response`

**Request Body:**

```json
{
  "messageId": "message1",
  "response": "Your request is being processed."
}
```
### Send a New Message/Query from client

To send a new message to the server, follow these steps:
**Route:** `POST /message`

**Request Body:**

```json
{
  "message": "Can you help me with this issue?",
  "senderId": "user789"
}
```

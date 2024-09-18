const { MessageModel } = require("../models");

module.exports = (io) => {
  io.on("connection", (socket) => {
    // console.log('A user connected: ' + socket.id);

    socket.on("joinRoom", (roomId) => {
      socket.join(roomId);
      // console.log(`User ${sender_id} joined room: ${roomId}`);
    });

    socket.on("sendMessage", async (roomId, message, image, sender_id) => {
      const messageData = {
        conservation_id: roomId,
        sender_id: sender_id,
        message: message,
        image: image,
      };
      await MessageModel.addMessage(messageData);
      // console.log(`Message from ${sender_id} to room ${roomId}: ${message}`);
      io.to(roomId).emit("receiveMessage", {
        senderId: sender_id,
        message: message,
        image: image,
      });
    });

    socket.on("disconnect", () => {
      console.log("");
    });
  });
};

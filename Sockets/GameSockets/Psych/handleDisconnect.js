const psychModel = require('../../../Models/psychModel');
const roomModel = require('../../../Models/roomModel');
const handleDisconnect = async (io, socket, roomID, username) => {
    console.log(`${username} Left Psych Room`)
    const room = await psychModel.findOne({ roomID });
    if (room) {
        const newUserList = room.users.filter(user => user.username !== username);
        //Check If Admin Left
        if(!newUserList[0])return;
        let hasAdmin = false, newAdmin = newUserList[0].username
        newUserList.forEach(user => {
            if (user.isAdmin) {
                hasAdmin = true;
                newAdmin = user.username;
            }
        });
        //Make New Admin
        if (!hasAdmin) {
            newUserList[0].isAdmin = true;
        }

        io.in(roomID).emit('changeAdmin', { adminUsername: newAdmin })
        await psychModel.findOneAndUpdate({ roomID }, { users: newUserList, adminUsername: newAdmin });
        io.in(roomID).emit('userLeftPsychRoom', { newGameState: newUserList });
        //Prematurely End Game
        if(newUserList.length<=1){
            const newRoom = new roomModel({
                roomID : roomID,
                users: [],
                roomName: room.roomName,
                adminUsername: room.adminUsername,
                selectedGame: -1
    
            });
            await newRoom.save();
    
            await psychModel.findOneAndDelete({roomID});
            io.in(roomID).emit('returnToLobbyFromPsych');
            return;
        }
        let unvoted = 0, unguessed = 0;
        newUserList.forEach(user => {
            if (!user.prompt) unguessed++;
            if (!user.hasVoted) unvoted++;
        });
        if (unvoted === 0) {
            //SHOW RESULTS
            setTimeout(() => {
                io.in(roomID).emit('showResults');
            }, 1000);
        }

        if (unguessed === 0) {
            //START VOTING
            setTimeout(() => {
                io.in(roomID).emit('startVoting');
            }, 1000);
        }
    }

    //DO NOTHING
}

module.exports = handleDisconnect;
// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.

	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.

		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);

// Do the Socket.IO magic:
var io = socketio.listen(app);

var admin = {username:"admin", roomIn:'lobby'};
var users = [admin];
var lobby = {name:"lobby", creator:"admin", password:"", usersHereNow: ['admin']};
var rooms = [lobby];

io.sockets.on("connection", function(socket){
	// console.log("im connected!");
	// This callback runs when a new Socket.IO connection is established.

	var socketID = socket.id;
	// console.log(socket.id);
	socket.on('adduser', function(username){
		// console.log("im in add user!");
		// we store the username in the socket session for this client
		var x = false;
		var currentUsers = users;
		for (i = 0; i < users.length; i++) {
			//THIS IF STATEMENT ISN'T WORKING
			if(users[i].username==username){
				x = true;
			}
		}

		if(x){
			//prompt for new username, say already taken
			socket.emit("alreadyTaken");
		}
		else{
			//http://psitsmike.com/2011/10/node-js-and-socket-io-multiroom-chat-tutorial/
			// https://gist.github.com/crtr0/2896891

			// store the username in the socket session for this client
			// socket.username = username;

			// add the client's username to the global list
			var newUser = {username:username, roomIn:"lobby", socketID:socketID};
			console.log("socketid" + newUser.socketID);
			users.push(newUser);
			lobby.usersHereNow.push(newUser);
			socket.join('lobby');
      		console.log(users);
			io.emit("updateUsers", users);
			// io.emit("updateUsers", lobby);
			socket.emit("myUser", newUser);
			io.in('lobby').emit("usersInRoom", {room:'lobby',users:users, roomCreator:admin});
			io.emit("currentRooms", rooms);
			socket.emit("newRoom", lobby);
		}
	});

	socket.on('addRoom', function(newRoomName, newRoomPass, fullUser){
		var x = false;
		for (i = 0; i < rooms.length; i++) {
			//THIS IF STATEMENT ISN'T WORKING
			if(rooms[i].name==newRoomName){
				x = true;
			}
		}

		if(x){
			//prompt for new room, say already taken
			socket.emit("roomAlreadyExists");
		}
		else{

			var newRoom = {name:newRoomName, creator:fullUser, password: newRoomPass, usersHereNow: [fullUser]};
			var oldRoom= fullUser.roomIn;
			var oldRoomCreator = rooms.find(room => room.name==oldRoom).creator;
			console.log('leaving ' + oldRoom);
			fullUser.roomIn = newRoom.name;
			//console.log(0-users.indexOf(user => user.username==fullUser.username));
			users.splice(users.findIndex(user => user.username==fullUser.username),1,fullUser);
			console.log(users)
			console.log('newRoom='+fullUser.roomIn);
			console.log('newroompass ='+newRoom.password);
			rooms.push(newRoom);
			socket.join(newRoom.name);
			socket.leave(oldRoom);
			io.in(newRoom.name).emit('usersInRoom', {room:newRoom.name, users:users, roomCreator:fullUser});
		  	io.in(oldRoom).emit('usersInRoom', {room:oldRoom, users:users, roomCreator:oldRoomCreator});
      		socket.emit("updatedUser", fullUser);
			io.emit("currentRooms", rooms);
			io.in(newRoom.name).emit("newRoom", newRoom);
			io.emit("updateUsers", users);
			io.in(oldRoom).emit("userLeft", fullUser.username);
			io.in(newRoom.name).emit("userJoined", fullUser.username);

			// echo to client they've connected
			// socket.emit('updatechat', 'SERVER', 'you have connected');
			// // echo globally (all clients) that a person has connected
			// socket.broadcast.emit('updatechat', 'SERVER', username + ' has connected');
			// // update the list of users in chat, client-side
			//socket.emit('updateusers', usernames);
		}
	});





	socket.on('message_to_server', function(data) {
		console.log("im in message to server!");
		// This callback runs when the server receives a new message from the client.

		console.log("message: "+data["message"]); // log it to the Node.JS output
		console.log('room= '+data.user.roomIn);
		io.in(data.user.roomIn).emit("message_to_client",{name:data["username"], message:data["message"] }) // broadcast the message to other users
	});

	socket.on('messageToPrivateServer', function(data) {
		var partnerSocketID = users.find(user => user.username==data.partner).socketID;
		var mySocketID = users.find(user => user.username==data.user.username).socketID;
		console.log("message: "+data.message); // log it to the Node.JS output
		console.log('to: '+ data.partner);
		console.log("from" + data.user.username);
		io.in(mySocketID).emit("aPrivateMessage",{to:data.partner, message:data.message, from:data.user.username }) // broadcast to other person
		io.in(partnerSocketID).emit("aPrivateMessage",{to:data.partner, message:data.message, from:data.user.username}) // broadcast to other person
	});

	socket.on('joinRoom', function(data){
	  console.log("room:"+data.room);
	  var roomPass = rooms.find(room => room.name==data.room).password;
	  var roomCreator = rooms.find(room => room.name==data.room).creator;
	  var oldRoomCreator = rooms.find(room => room.name==data.old).creator;
	  currentUsers = users;
	  if(roomPass === ""){
	    console.log('joining'+data.room);
		  var User = data.user;
		  User.roomIn = data.room;
		  users.splice(users.findIndex(user => user.username==User.username),1,User);
      	  console.log(users);
		  console.log('leaving ' + data.old);
		  socket.leave(data.old);
		  socket.join(data.room);
		  io.in(data.room).emit('usersInRoom', {room:data.room, users:users, roomCreator: roomCreator});
		  io.in(data.old).emit('usersInRoom', {room:data.old, users:users, roomCreator: oldRoomCreator});
		  socket.in(data.old).emit('usersInRoom', {room:data.old, users:users, roomCreator: oldRoomCreator});
		  socket.emit('joinRoomOnClient', data.room);
		  io.emit("updateUsers", users);
		  io.in(data.old).emit("userLeft", User.username);
		  io.in(data.room).emit("userJoined", User.username);
	  }
		else{
		  socket.emit("password?", data, roomPass);
		}
	});

	socket.on('joinRoom2', function(data){
	  console.log('actual password: '+data.roomPass + 'your guess: '+data.answer);
	  console.log(data);
	  if(data.roomPass == data.answer){
	    console.log('joining'+data.data.room);
		  var User = data.data.user;
		  User.roomIn = data.data.room;
		  users.splice(users.findIndex(user => user.username==User.username),1,User);
		  console.log('leaving ' + data.data.old);
		  socket.leave(data.data.old);
		  socket.join(data.data.room);
		  var roomCreator = rooms.find(room => room.name==data.data.room).creator;
		  var oldRoomCreator = rooms.find(room => room.name==data.data.old).creator;
		  console.log('users:'+users);
		  io.in(data.data.room).emit('usersInRoom', {room:data.data.room, users:users, roomCreator:roomCreator});
		  io.in(data.data.old).emit('usersInRoom', {room:data.data.old, users:users, roomCreator:oldRoomCreator});
		  socket.emit('joinRoomOnClient', data.data.room);
		  // io.in(data.data.old).emit("userLeft", User.username);
		  io.in(data.data.room).emit("userJoined", User.username);
		  io.emit("updateUsers", users);
	  }
		else{
		  socket.emit("wrongPass", data);
		}
	});

	socket.on("startPrivateChat", function(data){
		console.log(data);

		var newPartnerID = users.find(user => user.username==data.partner).socketID;
		var newPartnerUsername = users.find(user => user.username==data.partner).username;
		console.log(newPartnerID);
		console.log(users);

		// sending to individual socketid (private message)
  		io.to(newPartnerID).emit('openPrivateChat', data.me.username);
		console.log("fullUser.username= "+data.me.username);
		socket.emit('openPrivateChat', newPartnerUsername);

	});


	socket.on('kickUserOut', function(data){
		// console.log("KICKING out: "+data.person);
		//
		// socket
		// var oldRoom = users.find(user => user.username==data.person).roomIn; //getting old room
		//
		// users.find(user => user.username==data.person).roomIn = lobby; //actually moving them
		//
		// // socket.leave(oldRoom);
		// // socket.join(lobby);
		// io.in(mySocketID).leave(oldRoom);
		// io.in(mySocketID).join(lobby);
		//
		// //updating client stuff
		// io.emit("updateUsers", users);
		// io.in(oldRoom).emit("userLeft", data.person);
		// io.in(lobby).emit("userJoined", data.person);
	});



});

<?php

header("Content-Type: application/json"); // Since we are sending a JSON response here (not an HTML document), set the MIME Type to application/json

//Because you are posting the data via fetch(), php has to retrieve it elsewhere.
$json_str = file_get_contents('php://input');
//This will store the data into an associative array
$json_obj = json_decode($json_str, true);


//variables
$newUsername = htmlentities($json_obj['newUsername']);
$newPassword = htmlentities($json_obj['newPassword']);
$hashedPass = password_hash($newPassword, PASSWORD_BCRYPT);

// session_start();
$mysqli = new mysqli('localhost', 'wustl_inst', 'wustl_pass', 'Calendar');
if($mysqli->connect_errno) {
	printf("Connection Failed: %s\n", $mysqli->connect_error);
	exit;
}


$stmt = $mysqli->prepare("INSERT INTO users (username, password) values (?, ?)");
if(!$stmt){
	printf("Query Prep Failed: %s\n", $mysqli->error);
	exit;
}
// else{
//
// }
$stmt->bind_param('ss', $newUsername, $hashedPass);
$stmt->execute();
$stmt->close();

// when put the above in an else statement, don't get any errors...


echo json_encode(array(
	$newUsername)
	);

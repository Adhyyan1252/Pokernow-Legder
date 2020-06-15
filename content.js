class User{
	constructor(){
		this.buyin = 0;
		this.buyout = 0;
		this.names = [];
		this.id = [];
		this.quit = true;
		this.current = 0;
		this.transfer = 0;
	}

	net(){
		return this.buyout - this.buyin + this.current + this.transfer;
	}

	get_names(){
		return this.names.join("; ");
	}

	get_one_name(){
		return this.names[0];
	}

	get_ids(){
		return this.id.join("; ");
	}
}

//entry point
var log_button;
var checkExist = setInterval(function () {
  if (!document.body.contains(log_button)) {
  	console.log("FINDING LOG BUTTON");
    try {
      log_button = document.getElementsByClassName("button-1 show-log-button small-button dark-gray")[0];
      log_button.addEventListener("click", logButtonClicked, false);
    } catch {
      log_button = null;
    }
  }
}, 1000); // check every 1000ms

//Adds Ledger button to Log page
function logButtonClicked(){
	setTimeout(function(){
		//add the button 
		console.log("BUTTON CLICKED");
		var footer = document.querySelector(".modal-footer").children[0];

		var ledgerButton = document.createElement('button');
		ledgerButton.type = "button";
		ledgerButton.className = "button-1 green small-button";
		ledgerButton.innerHTML = "Ledger";
		ledgerButton.addEventListener("click", startLedger, false);

		
		footer.append(document.createTextNode( '\u00A0' ));
		footer.append(ledgerButton);
	}, 10)
	//add the button the modal thing
}

//Starts process to display ledger
function startLedger(){
	let b = document.getElementsByClassName("modal-body")[0]
	if(document.querySelector(".modal-footer"))
		document.getElementsByClassName("modal log-modal")[0].removeChild(document.querySelector(".modal-footer"));

	b.innerHTML = ""
	var p1 = document.createElement("p");
	p1.innerHTML = "Loading Ledger...";
	b.append(p1);
	getLog();
}


var log = [];

//gets log by querying the pokernow endpoint multiple times
function getLog(lastTime, minTime){
	if(minTime == undefined)
		log = [];

	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function(){
	if(xhttp.readyState === XMLHttpRequest.DONE) {
		rjs = JSON.parse(this.responseText);
		for(var i = 0; i < rjs.logs.length; i++){
			var row = rjs.logs[i];
			log.push(row.msg.slice(0, row.msg.length-1));
		}

		if(minTime == undefined){
			minTime = rjs['infos']['min'];
		}
		lastTime = rjs.logs[rjs.logs.length-1]['created_at'];

		if(lastTime > minTime){
			getLog(lastTime, minTime);
		}else{ 
			log = log.reverse();
			process(log, false, 1);	
		}
	}		
	}
	if(minTime == undefined){
		xhttp.open("GET", window.location.href + "/log?after_at=&before_at=&mm=true");
	}else{
		xhttp.open("GET", window.location.href + "/log?after_at=&before_at=" + lastTime + "&mm=true");
	}
	xhttp.send();			
}

//gets a user from the users array by the user_id.
//If none exists, then tried to find by name
//Otherwise, creates a new user and returns
//param merge: if true, merges users with same names
function get_user(user_id, name, users, merge=true){
	if(user_id in users){
		if(users[user_id].names.includes(name) == false)
			users[user_id].names.push(name);
		if(users[user_id].id.includes(user_id) == false)
			users[user_id].id.push(user_id);
		return users[user_id];
	}else if(merge == true){
		for(var uid in users){
			if(users[uid].names.includes(name) || users[uid].id.includes(user_id)){
				if(users[user_id].names.includes(name) == false)
					users[user_id].names.push(name);
				if(users[user_id].id.includes(user_id) == false)
					users[user_id].id.push(user_id);
				return users[uid];
			}
		}
	}
	users[user_id] = new User();
	users[user_id].names.push(name);
	users[user_id].id.push(user_id);
	return users[user_id];
}

//get a user by the name. doesn't avoid merge conflict
function get_user_by_name(name, users){
	for(var uid in users){
		if(users[uid].names.includes(name)){
			return users[uid];
		}
	}
	return undefined;
}

//returns a user list from the log
function process(log, verbose=false, multiplier=1){
	if(verbose) console.log(log);
	var users = {};
	var sum = 0;
	for(let ent of log){

		filter = ['WARNING', 'sit', 'stand', 'ownership']

		words = ent.split(" ");
		var found = false;
		for(let word of words){
			if(filter.includes(word)){
				found = true;
				break;
			}
		}
		if(found){
			continue;
		}

		if(!(ent.indexOf("player") == -1 && ent.indexOf("admin") == -1)){
			var name_and_id = ent.split("\"")[1];
			var name = name_and_id.split("@")[0];
			var id = name_and_id.split("@")[1];
			name = name.trim();
			id = id.trim();
			var user = get_user(id, name, users);

			if(ent.indexOf("approved") != -1 || ent.indexOf("created") != -1){
				var value = parseInt(words[words.length-1], 10);

				if(user.buyout == value){
					sum += value;
					if(verbose){
						console.log("REJOIN " + name  + " : " + value);
					}
					user.buyout = 0;
				}else{
					sum += value;
					if(verbose){
						console.log("JOIN " + name + " : " + value);
					}
					user.buyin += value;
				}
				user.quit = false;
			}else if(ent.indexOf("quits") != -1){
				var value = parseInt(words[words.length-1], 10);

				sum -= value;
				if(verbose){
					console.log("QUIT: " + name + " : " + value);
				}
				user.buyout += value;
				user.quit = true;
			}else if(ent.indexOf("updated") != -1){
				var new_value = parseInt(words[words.length-1], 10);
				var old_value = parseInt(words[words.length-3], 10);

				if(verbose){
					console.log("UPDATE " + name + " : " + old_value +  " -> " + new_value);
				}
				sum += new_value - old_value;
				if(old_value - new_value <= user.buyin){
					user.buyin += new_value - old_value;
				}else{
					user.buyout += old_value - new_value;
				}
				user.quit = false;
			}
		}
	}

	var names = document.getElementsByClassName("table-player-name");
	var stacks = document.getElementsByClassName("table-player-stack");
	if(names.length == stacks.length){
		for(let i = 0; i < names.length; i++){
			let curn = names[i].innerText;
			let curv = 0;
			var numb = stacks[i].innerText.match(/\d+/g);
			for(let c of numb) curv += parseInt(c, 10);
			var u = get_user_by_name(curn, users);
			if(u == undefined){
				console.log("Couldnt find user by name: " + curn);
			}else{
				u.current = curv;
			}
		}
	}

	for(var uid in users){
		users[uid].buyout *= multiplier;
		users[uid].buyin *= multiplier;
		users[uid].current *= multiplier;
	}
	sum *= multiplier;
	if(verbose){
		console.log("SUM : " + sum);
	}

	displayAllLedger(users, false, null);
}

//displays the UI for the ledger screen
//including calling table display, and buttons
function displayAllLedger(users, old_game, gameId){

	if(old_game == false) gameId = window.location.href.split("/").pop();

	var b = document.getElementsByClassName("modal-body")[0];
	b.style = "height : 100%;";
	b.innerHTML = "";

	function displayTransactionsButton(disabled=false){	
		// /console.log(disabled);
		var button = document.createElement('button');
		button.type = "button";
		button.className = "button-1 " + (disabled?"gray":"green") + " small-button";
		button.innerHTML = "Generate Transactions";
		button.users = users;	
		button.addEventListener("click", generateTransactions, false);	
		if(disabled)
			button.setAttribute("disabled", "");
		return button;
	}

	function displaySaveButton(disabled=false){
		var button = document.createElement('button');
		button.type = "button";
		button.className = "button-1 " + (disabled?"gray":"green") + " small-button";
		button.id = "save-game";
		button.innerHTML = "Save Game";
		button.users = users;
		button.addEventListener("click", saveGame, false);		
		if(disabled)
			button.setAttribute("disabled", "");

		return button;
	}
	
	function displayPreviousGamesButton(){
		var previousButton = document.createElement('button');
		previousButton.type = "button";
		previousButton.className = "button-1 green small-button";
		previousButton.innerHTML = "Previous Games";
		previousButton.addEventListener("click", startPreviousGames, false);
		return previousButton;
	}

	var headingText = document.createElement("p");
	if(old_game){
		headingText.innerHTML = "<b>Showing Saved Game. ID: " + gameId + "</b>";
	}else{
		headingText.innerHTML = "<b>Showing Current Game. ID: " + gameId + "</b>";
	}
	b.append(headingText);

	let inHand = displayLedgerTable(users, old_game);
	addTransfers(users, old_game);



	if(old_game){
		b.append(displayTransactionsButton(inHand!=0));
		b.appendChild(document.createTextNode( '\u00A0' ));
		b.append(displayPreviousGamesButton());
		b.appendChild(document.createTextNode( '\u00A0' ));
	}else{
		b.append(displayTransactionsButton(inHand!=0));
		b.appendChild(document.createTextNode( '\u00A0' ));

		b.append(displaySaveButton(inHand!=0));
		b.appendChild(document.createTextNode( '\u00A0' ));
		
		b.append(displayPreviousGamesButton());
		b.appendChild(document.createTextNode( '\u00A0' ));	
	}
	
}

//saves current game to local storage
function saveGame(evt){
	var users = evt.currentTarget.users;
	evt.currentTarget.innerHTML = "Save Again";
	var gameId = window.location.href.split("/").pop();	
	console.log("Saved game: " + gameId);
	chrome.storage.sync.set({[gameId]: {users: users, date:(new Date()).toLocaleString()}}, function() {
      console.log(users);
    });
}

//collates information from users list to an array
//helper function to display data
function getTableData(users, old_game=false){
	var data = [];
	var total_buyin = 0;
	var total_buyout = 0;
	var total_net = 0;
	var total_current = 0;
	var total_players = 0;
	var total_transfer = 0;

	for(let uid in users){
		var u = users[uid];
		let id_str = "<abbr title=\"" + u.get_ids() + "\">" + uid + "</abbr>";
		let name_str = "<abbr title=\"" + u.get_names() + "\">" + u.get_one_name() + "</abbr>";
		var cur = [id_str, name_str, u.buyin, u.buyout, u.current, u.transfer, u.net(), u.quit?0:1];
		data.push(cur);
		total_buyin += u.buyin;
		total_buyout += u.buyout;
		total_net += u.net();
		total_players += (u.quit == false)?1:0;
		total_current += u.current;
		total_transfer += u.transfer;
	}

	var curSum = 0;
	if(old_game == false){
		var currentHand = document.getElementsByClassName("table-player-bet-value");
		for(let c of currentHand){
			if(c.innerHTML != "check"){
				curSum += parseInt(c.innerHTML, 10);
			}
		}
		curSum += parseInt(document.querySelector(".table-pot-size").innerHTML);
		total_current += curSum;
		total_net += curSum;	
		var cur = ["", "<b>Current Hand</b>", "", "", curSum, "", curSum, "-"]
		data.push(cur);
	}
	
	var total = ["", "<b>Total</b>", "<b>"+total_buyin+"</b>", "<b>"+total_buyout+"</b>",
	"<b>"+total_current +"</b>", "<b>"+total_transfer+"</b>", "<b>"+total_net+"</b>", "<b>"+total_players+"</b>"];

	data.push(total);
	return {data : data, inHand : curSum};
}

//displays ledger table
function displayLedgerTable(users, old_game=false){
	var b = document.getElementsByClassName("modal-body")[0];
	var tableDiv = document.createElement("div");
	tableDiv.id = "ledger-table";
	var table = document.createElement("table");
	var ret = getTableData(users, old_game);
	var data = ret.data;
	var inHand = ret.inHand;


	table.style = "width: 100%";
	for(let ele of data){
		let row = table.insertRow();
		for(let v of ele){
			let cell = row.insertCell();
			cell.style = "margin-top:6px; margin-bottom: 6px; text-align: left; border-bottom: 1px solid #ddd";
			cell.innerHTML = String(v);
		}
	}

	let header = ["ID", "Name", "Buy In", "Buy Out", "Current","Transfer", "Net", "Playing"];
	let thead = table.createTHead();
	let row = thead.insertRow();
	for(let key of header){
		let th = document.createElement("th");
		let text = document.createTextNode(key);
		th.style = "padding-bottom:7px; text-align: left; border-bottom: 1px solid #ddd";
		th.appendChild(text);
		row.appendChild(th);
	}

	tableDiv.appendChild(table);
	if(document.querySelector("#ledger-table")){
		b.replaceChild(tableDiv, document.querySelector("#ledger-table"));
	}else{
		b.appendChild(tableDiv);	
	}
	
	return inHand;
}

//Adds buttons to send transfers
function addTransfers(users, old_game=false){
	var b = document.getElementsByClassName("modal-body")[0];
	var from = document.createElement("SELECT");
	//<option hidden disabled selected value> -- select an option -- </option>
	var fromDef = document.createElement("OPTION");
	fromDef.setAttribute("disabled", "");
	fromDef.setAttribute("selected", "");
	fromDef.setAttribute("value", "");
	fromDef.text = "Sender";
	from.add(fromDef);

	for(let uid in users){
		let name = users[uid].get_one_name();
		var op = document.createElement("OPTION");
		op.text = name;
		from.add(op);
	}

	var to = document.createElement("SELECT");

	var toDef = document.createElement("OPTION");
	toDef.setAttribute("disabled", "");
	toDef.setAttribute("selected", "");
	toDef.setAttribute("value", "");
	toDef.text = "Receiver";
	to.add(toDef);

	for(let uid in users){
		let name = users[uid].get_one_name();
		var op = document.createElement("OPTION");
		op.text = name;
		to.add(op);
	}

	var amt = document.createElement("INPUT");
	amt.setAttribute("type", "number");

	var sub = document.createElement("BUTTON");
	sub.innerHTML = "Update";
	sub.onclick = function(){
		b = document.getElementsByClassName("modal-body")[0];
		let fromName = from.options[from.selectedIndex].text;
		let fromUser = get_user_by_name(fromName, users)

		let toName = to.options[to.selectedIndex].text;
		let toUser = get_user_by_name(toName, users);

		let val = parseInt(amt.value, 10);
		if(Number.isInteger(val)){
			console.log(fromUser.get_one_name() + ": " + toUser.get_one_name() + " : " + val);
			fromUser.transfer -= val;
			toUser.transfer += val;
			displayLedgerTable(users, old_game);		
		}
			
		
		amt.value = 0;
	}
	var transfersDiv = document.createElement("div");
	transfersDiv.id = "transfers";
	transfersDiv.appendChild(document.createElement("br"));
	transfersDiv.appendChild(from);
	transfersDiv.appendChild(document.createTextNode("  gives  "));
	transfersDiv.appendChild(to);
	transfersDiv.appendChild(document.createTextNode( '\u00A0' ));
	transfersDiv.appendChild(amt);
	transfersDiv.appendChild(document.createTextNode( '\u00A0' ));
	transfersDiv.appendChild(sub);
	transfersDiv.appendChild(document.createElement("br"));
	transfersDiv.appendChild(document.createElement("br"));
	b.appendChild(transfersDiv);
}

//displays a decentralised bank
function generateTransactions(evt){
	let temp = document.querySelector(".transactions");
	if(evt.currentTarget.parentNode.contains(temp)){
		evt.currentTarget.parentNode.removeChild(temp);
	}

	var credit = [];
	var debit = [];
	var users = evt.currentTarget.users;
	//evt.currentTarget.parentNode.removeChild(evt.currentTarget);
	var sum = 0;
	for(let uid in users){
		let u = users[uid];
		if(u.net() > 0)
			credit.push({name : u.get_one_name(), amt : u.net()});
		else if(u.net() < 0)
			debit.push({name : u.get_one_name(), amt : -u.net()});
		sum += u.net();
	}

	if(sum != 0){
		let b = document.getElementsByClassName("modal-body")[0]
		b.innerHTML += "<p>Sum doesn't add upto 0</p>";
		return;
	}


	credit.sort(function(a, b){
		return a.amt - b.amt;
	});

	debit.sort(function(a, b){
		return a.amt - b.amt;
	})

	var t = [];
	while(credit.length > 0 && debit.length > 0){
		var c = credit.pop();
		var d = debit.pop();
		var m = Math.min(c.amt, d.amt);
		t.push({sender: d.name, receiver : c.name, amt : m});
		c.amt -= m;
		d.amt -= m;
		if(c.amt > 0) credit.push(c);
		if(d.amt > 0) debit.push(d);
	}

	var text = document.createElement("div");
	text.className = "transactions";
	console.log(t);
	text.appendChild(document.createElement("br"));
	for (let a of t){
		console.log(a);
		var p = document.createElement("p");
		p.innerHTML += a.sender + " owes " + a.receiver + " " + a.amt;
		text.appendChild(p);
	}

	let b = document.getElementsByClassName("modal-body")[0]
	b.style.setProperty('scroll-behavior', 'smooth');
	b.appendChild(text);
	b.scrollTop = b.scrollHeight;
}


//------------ Previous Game Page -----------------------

function convertObjectToUser(obj){
	var ret = new User();
	ret.buyin = obj.buyin;
	ret.buyout = obj.buyout;
	ret.names = obj.names;
	ret.id = obj.id;
	ret.quit = obj.quit;
	ret.current = obj.current;
	ret.transfer = obj.transfer;
	return ret;
}

//Starts process of displaying previous games
function startPreviousGames(){
	let b = document.getElementsByClassName("modal-body")[0];
	if(document.querySelector(".modal-footer"))
		document.getElementsByClassName("modal log-modal")[0].removeChild(document.querySelector(".modal-footer"));

	b.innerHTML = ""
	var p1 = document.createElement("p");
	p1.innerHTML = "Loading Previous Games...";
	b.append(p1);
	chrome.storage.sync.get(null, displayPreviousGames);
}

//Called by chrome after previous games have been retrieved
//collates data in table and displays
function displayPreviousGames(items){
	console.log("ITEMS: "); console.log(items);
	let b = document.getElementsByClassName("modal-body")[0]
	b.innerHTML = "";
	var gameDivs = document.createElement("div");
	gameDivs.className = "games";
	var data = []

	var sortedKeys = Object.keys(items);
	sortedKeys.sort(function(a, b){
		let ad = new Date(items[a].date);
		let bd = new Date(items[b].date);
		return (ad < bd)?1:((ad == bd)?0:-1);
	});
	
	for(let key of sortedKeys){

		let users =  items[key].users;
		var user_count = 0, total_size = 0;
		for(let user_id in users){
			users[user_id] = convertObjectToUser(users[user_id]);
			user_count += 1;
			total_size += Math.max(users[user_id].net(), 0);
		}

		var cur = [key, items[key].date, user_count, total_size];
		data.push(cur);
	}

	var table = document.createElement("table");

	table.style = "width: 100%";
	for(let ele of data){
		let row = table.insertRow();
		row.id = ele[0];

		for(let v of ele){
			let cell = row.insertCell();
			cell.style = "margin-top:6px; margin-bottom: 6px; text-align: left; border-bottom: 1px solid #ddd";
			cell.innerHTML = String(v);
		}

		let deleteButton = document.createElement("button");
		deleteButton.type = "button";
		deleteButton.innerText = "Delete";
		deleteButton.addEventListener("click", function(evt){
			let curId = evt.currentTarget.parentNode.parentNode.id;
			chrome.storage.sync.remove([curId],function(){
			 	var error = chrome.runtime.lastError;
			    if (error) {
			        console.error(error);
			    }
			});
			startPreviousGames();
		});
		row.insertCell().append(deleteButton);
		
		
		row.children[0].addEventListener("click", function(evt){
			let curId = evt.currentTarget.parentNode.id;
			displayAllLedger(items[curId].users, true, curId);
		});
	}

	let header = ["Game ID", "Saved at", "#Players", "Total Winnings", "  "];
	let thead = table.createTHead();
	let row = thead.insertRow();
	for(let key of header){
		let th = document.createElement("th");
		let text = document.createTextNode(key);
		th.style = "padding-bottom:7px; text-align: left; border-bottom: 1px solid #ddd";
		th.appendChild(text);
		row.appendChild(th);
	}

	b.style = "height : 100%;";
	gameDivs.appendChild(table);	
	b.append(gameDivs);

	function displayGoBackButton(){	
		var button = document.createElement('button');
		button.type = "button";
		button.className = "button-1 green small-button";
		button.innerHTML = "Go Back";
		button.addEventListener("click", startLedger, false);	
		return button;
	}

	function displaySummaryButton(){	
		var button = document.createElement('button');
		button.type = "button";
		button.className = "button-1 green small-button";
		button.innerHTML = "Summary";
		button.addEventListener("click", function(){
			displayAllLedger(makeSummary(items), true, "Summary");
		}, false);	
		return button;
	}
	b.append(document.createElement("br"));
	b.append(displaySummaryButton());
	b.append(document.createTextNode( '\u00A0' ))
	b.append(displayGoBackButton());
}

//-----Functions to make aggregate scores-------------

function mergeUsers(a, b){
	if(b == null) b = new User();
	var ret = new User();
	ret.buyin = a.buyin + b.buyin;
	ret.buyout = a.buyout + b.buyout;
	ret.transfers = a.transfers + b.transfers;
	ret.current = a.current + b.current;
	for(let name of a.names){
		if(!ret.names.includes(name)) ret.names.push(name);
	}
	for(let id of a.id){
		if(!ret.id.includes(id)) ret.id.push(id);
	}
	for(let name of b.names){
		if(!ret.names.includes(name)) ret.names.push(name);
	}
	for(let id of b.id){
		if(!ret.id.includes(id)) ret.id.push(id);
	}
	ret.quit = true;
	return ret;
}

function shouldMerge(a, b){
	for(let name of b.names){
		if(a.names.includes(name)) return true;
	}
	for(let id of b.id){
		if(a.id.includes(id)) return true;
	}
	return false;
}

function makeSummary(items){
	var users = {}

	for(let game_id in items){
		var cur = items[game_id].users;
		for(var user_id in cur){
			var merged = false;
			for(var oid in users){
				//check if should be merged
				if(shouldMerge(cur[user_id], users[oid])){
					merged = true;
					users[oid] = mergeUsers(users[oid], cur[user_id]);
					break;
				}
			}
			if(!merged){
				users[user_id] = mergeUsers(cur[user_id], null);
			}
		}
	}

	for(let user_id in users){
		let u = users[user_id];
		u.buyout += u.current;
		u.current = 0;
	}
	console.log(users);
	return users;
}


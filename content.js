

//entry point
var log_button;
var checkExist = setInterval(function () {
  if (!document.body.contains(log_button)) {
  	console.log("FINDING LOG BUTTON");
    try {
      log_button = document.getElementsByClassName("button-1 show-log-button small-button dark-gray")[0];
      log_button.addEventListener("click", buttonClicked, false);
    } catch {
      log_button = null;
    }
  }
}, 1000); // check every 1000ms


function buttonClicked(){
	setTimeout(function(){
		//add the button 
		console.log("BUTTON CLICKED");
		var footer = document.querySelector(".modal-footer").children[0];
		var button = document.createElement('button');

		button.type = "button";
		button.className = "button-1 green small-button";
		button.innerHTML = "Ledger";
		var space = document.createTextNode( '\u00A0' ) 
		footer.append(space);
		footer.append(button);
		button.addEventListener("click", displayLedger, false);
	}, 10)
	//add the button the modal thing
}


function displayLedger(){

	let b = document.getElementsByClassName("modal-body")[0]
	document.getElementsByClassName("modal log-modal")[0].removeChild(document.getElementsByClassName("modal-footer")[0]);

	b.innerHTML = ""
	var p1 = document.createElement("p");
	p1.innerHTML = "Loading Ledger...";
	b.append(p1);
	getLog();
}

var log = [];

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


class User{
	constructor(){
		this.buyin = 0;
		this.buyout = 0;
		this.names = new Set();
		this.id = new Set();
		this.quit = true;
		this.current = 0;
	}

	net(){
		return this.buyout - this.buyin + this.current;
	}

	get_names(){
		let ret = "";
		for(let name of this.names){
			ret += name + "; ";
		}
		return ret.slice(0, ret.length-2);
	}

	get_one_name(){
		for(let name of this.names){
			return name;
		}
	}

	get_ids(){
		let ret = "";
		for(let name of this.id){
			ret += name + "; ";
		}
		return ret.slice(0, ret.length-2);	
	}

}


function get_user(user_id, name, users, merge=true){
	if(user_id in users){
		users[user_id].names.add(name);
		users[user_id].id.add(user_id);
		return users[user_id];
	}else if(merge == true){
		for(var uid in users){
			if(users[uid].names.has(name) || users[uid].id.has(user_id)){
				users[uid].names.add(name);
				users[uid].id.add(user_id);
				return users[uid];
			}
		}
	}

	users[user_id] = new User();
	users[user_id].names.add(name);
	users[user_id].id.add(user_id);
	return users[user_id];
}

function get_user_by_name(name, users){
	for(var uid in users){
		if(users[uid].names.has(name)){
			return users[uid];
		}
	}
	return undefined;
}

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

	
	addToTable(users);
}


function getTableData(users){
	var data = [];
	var total_buyin = 0;
	var total_buyout = 0;
	var total_net = 0;
	var total_current = 0;
	var total_players = 0;;

	for(let uid in users){
		var u = users[uid];
		let id_str = "<abbr title=\"" + u.get_ids() + "\">" + uid + "</abbr>";
		let name_str = "<abbr title=\"" + u.get_names() + "\">" + u.get_one_name() + "</abbr>";
		var cur = [id_str, name_str, u.buyin, u.buyout, u.current, u.net(), u.quit?0:1];
		data.push(cur);
		total_buyin += u.buyin;
		total_buyout += u.buyout;
		total_net += u.net();
		total_players += (u.quit == false)?1:0;
		total_current += u.current;
	}

	var currentHand = document.getElementsByClassName("table-player-bet-value");
	var curSum = 0;
	for(let c of currentHand){
		if(c.innerHTML != "check"){
			curSum += parseInt(c.innerHTML, 10);
		}
	}
	curSum += parseInt(document.querySelector(".table-pot-size").innerHTML);
	total_current += curSum;
	total_net += curSum;

	var cur = ["", "<b>Current Hand</b>", "", "", curSum, curSum, "-"]
	var total = ["", "<b>Total</b>", "<b>"+total_buyin+"</b>", "<b>"+total_buyout+"</b>",
	"<b>"+total_current +"</b>", "<b>"+total_net+"</b>", "<b>"+total_players+"</b>"];

	data.push(cur);
	data.push(total);
	return {data : data, inHand : curSum};
}

function addToTable(users){
	var table = document.createElement("table");
	var ret = getTableData(users);
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

	let header = ["ID", "Name", "Buy In", "Buy Out", "Current", "Net", "Playing"];
	let thead = table.createTHead();
	let row = thead.insertRow();
	for(let key of header){
		let th = document.createElement("th");
		let text = document.createTextNode(key);
		th.style = "padding-bottom:7px; text-align: left; border-bottom: 1px solid #ddd";
		th.appendChild(text);
		row.appendChild(th);
	}

	let b = document.getElementsByClassName("modal-body")[0]
	b.style = "height : 100%;";
	b.innerHTML = "";
	b.appendChild(table);

	if(inHand == 0){
		var button = document.createElement('button');
		button.type = "button";
		button.className = "button-1 green small-button";
		button.innerHTML = "Generate Transactions";
		b.appendChild(button);
		button.users = users;
		button.addEventListener("click", generateTransactions, false);
	}
}

function generateTransactions(evt){
	var credit = [];
	var debit = [];
	var users = evt.currentTarget.users;
	evt.currentTarget.parentNode.removeChild(evt.currentTarget);
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
	for (let a of t){
		console.log(a);
		var p = document.createElement("p");
		p.innerHTML += a.sender + " owes " + a.receiver + " " + a.amt;
		text.appendChild(p);
	}

	let b = document.getElementsByClassName("modal-body")[0]
	b.appendChild(document.createElement("br"));
	b.appendChild(text);

}


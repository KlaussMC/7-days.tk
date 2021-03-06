'use strict';
const express = require('express');
const router = express.Router();

const auth = require("./auth")
const main = require("./main")

const fs = require('fs')
const less = require("less")

const webpush = require('web-push');

const bodyParser = require('body-parser')

const logmaker = require('logmaker');

const path = require('path');

const title = "7-days.tk";

/* GET home page. */
router.get('/', function(req, res, next) {
	if (req.session.signedIn)
		res.render('index', {
			title,
			username: req.session.user,
			signedIn: req.session.signedIn,
			errors: req.session.errors
		});
	else
		res.render('index', {
			title,
			errors: req.session.errors
		});
});
router.post('/', function(req, res) {
	let login = auth.login(req.body.un, req.body.pw)
	logmaker.log(login)
	req.session.user = req.body.un;
	req.session.signedIn = login === 2;
	req.session.fromSignup = false;
	// 1 is pending, 2 is a success, 3 is a password failure, 4 is unknown username
	if (login >= 3) {
		if (login == 4) {
			req.session.error = "Unknown Username";
		} else {
			req.session.error = "Wrong Password";
		}
	}
	res.redirect('/dashboard')
});
router.get('/signup', function(req, res) {
	res.render("signup", {
		title,
		errors: req.session.errors
	})
})
router.post('/signup', function(req, res) {
	let signup = auth.signup(req.body.un, req.body.email, req.body.pw, req.body.pc);
	logmaker.log(signup)
	req.session.user = req.body.un;
	req.session.signedIn = signup == 1;
	req.session.fromSignup = true;

	req.session.error = signup

	if (signup === 1)
		res.redirect("/dashboard")
	else {
		res.render("signup", {
			title,
			errors: signup
		})
	}
})

router.get('/dashboard', function(req, res) {
	if (req.session.signedIn) {
		if (main.whitelist.indexOf(req.session.user) > -1) {
			res.render("dashboard", {
				title,
				tables: main.getTables(req.session.user),
				username: req.session.user,
				signedIn: true
			})
		} else {
			req.session.signedIn = false;
			res.render("development", {
				title
			})
		}
	} else {
		if (req.session.fromSignup)
			res.redirect('/signup')
		else
			res.redirect('/')
	}
})
router.get("/calendar", function(req, res) {
	if (req.session.signedIn) {
		if (main.whitelist.indexOf(req.session.user) > -1) {
			res.render("calendar", {
				title,
				tables: main.getTables(req.session.user),
				username: req.session.user,
				signedIn: true
			})
		} else {
			req.session.signedIn = false;
			res.render("development", {
				title
			})
		}
	} else {
		if (req.session.fromSignup)
			res.redirect('/signup')
		else
			res.redirect('/')
	}
})
router.post('/calendar', function(req, res) {
	console.log(req.body);
	res.send("Got it");
})
router.post('/logout', function(req, res) {
	req.session.signedIn = false
	req.session.errors = "Log Out Successfull"
	res.redirect('/')
})
router.get('/dashboard/:table', function(req, res) {
	if (req.session.signedIn) {
		res.render('tableEditor', {
			title,
			table: main.readTable(req.session.user, req.params.table),
			signedIn: true
		})
	} else {
		req.session.errors = "You need to log in first"
		res.redirect('/')
	}
})
router.put('/dashboard/save', function(req, res) {
	let ajax = req.xhr;
	if (ajax) {
		let response = main.saveTable(req.session.user, req.body)
		res.send(response)
	}
})
router.put('/dashboard/deleteTable', function(req, res) {
	if (req.session.signedIn) {
		try {
			main.deleteTable(req.session.user, req.body.table)
			res.send('1')
		} catch (e) {
			logmaker.log(e)
		}
	}
})
router.get('/myaccount', function(req, res) {
	if (req.session.signedIn) {
		console.log('theme: ' + main.getThemeId(req.session.user));
		res.render('myaccount', {
			title,
			settings: main.getUserSettings(req.session.user),
			username: req.session.user,
			signedIn: true,
			theme: main.getThemeId(req.session.user)
		})
	} else {
		req.session.errors = "You need to log in first"
		res.redirect('/')
	}
})
router.get('/myaccount/pic', function(req, res) {
	if (req.session.signedIn) {
		res.send(main.getProfPic(req.session.user))
	} else {
		req.session.errors = "You need to log in first"
		res.redirect('/')
	}
})
router.put('/myaccount/saveSettings', function(req, res) {
	bodyParser.json({
		limit: "3mb"
	})
	if (req.xhr) {
		res.send(new String(main.changes(req.body, req.session.user)))
	}
})
router.post("/newTable", function(req, res) {
	if (req.session.signedIn) {
		res.send(main.newTable(req.session.user, req.body))
	} else {
		res.send('0');
	}
})
router.post('/docs', function(req, res) {
	let query = req.body.search;
	let spawn = require("child_process").spawn;
	let pythonProcess = spawn('python', ["./scan.py", query]);
	pythonProcess.stdout.on('data', function(data) {
		let returnedQuery = data.toString('utf8').trim().split(",")
		let results = []
		returnedQuery.forEach(item => {
			let doc = {
				text: item.slice(0, item.length),
				url: item.substring(0, item.length)
			}
			doc.text = doc.text.replace(/([A-Z])/g, ' $1').trim();
			doc.text = doc.text[0].toUpperCase() + doc.text.substring(1)
			results.push(doc)
		})
		res.render('docs/results', {
			title,
			results,
			username: req.session.user,
			signedIn: req.session.signedIn
		})
	});
})
router.get('/docs', function(req, res) {
	res.render('docs/docindex', {
		title,
		username: req.session.user,
		signedIn: req.session.signedIn,
		docPages: main.getDocs()
	})
})
router.get('/docs/:page', function(req, res) {
	res.render('docs/' + req.params.page, {
		title,
		username: req.session.user,
		signedIn: req.session.signedIn
	})
})

let publicKey = "BPKB6MzMh3GCxBSHY3LqwFJ0SOJIXBssaEpezIC4WHstHORnyuvUSZxzbyc9CXs8gB031B3tWnduJnT_7oRlFDA"
let privateKey = "9f1q9EsqJnN35M4t38rEYqEdIijeHP7iSt7UgGeKwPo"
webpush.setVapidDetails('mailto:jakieschneider13@gmail.com', publicKey, privateKey)

router.post('/subscribe', function(req, res) {
	// get push sub obj
	// logmaker.log(req.session)
	if (req.session.signedIn) {
		let subscription = req.body
		logmaker.log(subscription)
		res.status(201).json({});

		// let payload = JSON.stringify(main.getPayload(req.session.user))
		let payload = JSON.stringify({
			title: "hello world"
		})

		webpush.sendNotification(subscription, payload)
			.catch(err => logmaker.log(err))
	} else {
		res.status(200).json({})
	}
})

// static files

router.get('/css/master.css', function(req, res) {
	res.set('Content-Type', 'text/css');
	let input = fs.readFileSync(__dirname + '/less/master.less', 'utf-8')
	let options = {
		modifyVars: {
			blue: main.getTheme(req.session.user || 1)
			/*,
						darkgrey: "#dacbff",
						lightColor: "#2d2f44"*/
		}
	}
	less.render(input, options, function(err, result) {
		if (err) {
			logmaker.log(err)
		} else {
			res.send(result.css)
		}
	})
})
router.get('/css/main.css', function(req, res) {
	res.set('Content-Type', 'text/css');
	let input = fs.readFileSync(__dirname + '/less/main.less', 'utf-8')
	let options = {
		modifyVars: {
			blue: main.getTheme(req.session.user || 1)
			/*,
						darkgrey: "#dacbff",
						lightColor: "#2d2f44"*/
		}
	}
	less.render(input, options, function(err, result) {
		res.send(result.css)
	})
})
router.get('/css/calendar.css', function(req, res) {
	res.set('Content-Type', 'text/css');
	let input = fs.readFileSync(__dirname + '/less/calendar.less', 'utf-8')
	let options = {
		modifVars: {
			blue: main.getTheme(req.session.user || 1)
			/*,
						darkgrey: "#dacbff",
						lightColor: "#2d2f44"*/
		}
	}
	less.render(input, options, function(err, result) {
		res.send(result.css)
	})
})
router.get('/hostedImages/:image', function(req, res) {
	let img = req.params.image
	logmaker.log(img)
	res.send(fs.readFileSync(`./hostedImages/${img}`))
})

router.get('/.well-known/acme-challenge/:file', (req, res) => {
	res.write(fs.readFileSync(path.join(__dirname, path.join('.well-known/acme-challenge/' + req.params.file))))
	res.end();
})

// router.get('/tmp/tanks.zip', (req, res) => {
// 	res.send(fs.readFileSync("C:/Users/Jacob/Desktop/Tanks.zip"))
// })
router.get('/tmp/chat.zip', (req, res) => {
	res.send(fs.readFileSync("C:/Users/Jacob Schneider/Code/Non-GIT/CLI Chat/app.zip"))
})
// router.get('/tmp/processing.zip', (req, res) => {
// 	res.send(fs.readFileSync("C:/Users/Jacob Schneider/Desktop/processing-3.4.zip"))
// });

module.exports = router;
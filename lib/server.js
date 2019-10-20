/*
 * Server-related tasks
 */
// Dependency
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');

// Instantiate the server module object
const server = {};

// Instantiate the HTTP server
server.httpServer = http.createServer((req, res) => {
	server.unifiedServer(req, res);
});

// Instantiate the HTTPs server
server.httpsServerOptions = {
	key: fs.readFileSync(path.join(__dirname, '../https/key.pem')),
	cert: fs.readFileSync(path.join(__dirname, '../https/cert.pem')),
};
server.httpsServer = https.createServer(
	server.httpsServerOptions,
	(req, res) => {
		server.unifiedServer(req, res);
	},
);

// All the server logic for both the http and https server
server.unifiedServer = (req, res) => {
	// Get the url and parse it
	const parsedUrl = url.parse(req.url, true);

	// get the path from the url
	const path = parsedUrl.pathname;
	const trimmedPath = path.replace(/^\/+|\/+$/g, '');

	// get the query string as an object
	const queryString = parsedUrl.query;

	// Get the http method
	const method = req.method.toLowerCase();

	// get the headers as an object
	const headers = req.headers;

	// get the payload, if any
	const decoder = new StringDecoder('utf-8');
	let buffer = '';
	req.on('data', data => {
		buffer += decoder.write(data);
	});
	req.on('end', () => {
		buffer += decoder.end();

		// Choose the handler this request should go to. if one isn't found, use the notFound handler
		const chosenHandler =
			typeof server.router[trimmedPath] !== 'undefined'
				? server.router[trimmedPath]
				: handlers.notFound;

		const payload = helpers.parseJsonToObject(buffer);

		// Construct the data object to send to the handler
		const data = {
			trimmedPath,
			queryString,
			method,
			headers,
			payload,
		};
		// Route the request to the handler specified in the router.
		chosenHandler(data, (statusCode, payload) => {
			// Use the status code called back by the handler, or default to 200
			statusCode = typeof statusCode == 'number' ? statusCode : 200;

			//  Use the payload code called back by the handler, or default to an empty object
			payload = typeof payload == 'object' ? payload : {};

			// Convert the payload to a string
			const payloadString = JSON.stringify(payload);
			// return the response
			res.setHeader('Content-Type', 'application/json');
			res.writeHead(statusCode);
			res.end(payloadString);
			// log the request path
			console.log('Returning this response: ', statusCode, payloadString);
		});
	});
};

// Define a request router
server.router = {
	ping: handlers.ping,
	users: handlers.users,
	tokens: handlers.tokens,
	checks: handlers.checks,
};

// Init script
server.init = () => {
	// start the HTTP server.
	server.httpServer.listen(config.httpPort, () => {
		console.log('The server is listening on port ' + config.httpPort + ' now');
	});

	// start the HTTPs server.
	server.httpsServer.listen(config.httpsPort, () => {
		console.log('The server is listening on port ' + config.httpsPort + ' now');
	});
};
// Export the module
module.exports = server;

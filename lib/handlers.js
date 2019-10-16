/**
 * Request handlers
 */

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

// Define the handlers
const handlers = {};

// Users handler
handlers.users = (data, callback) => {
	const acceptableMethods = ['post', 'get', 'put', 'delete'];
	if (acceptableMethods.indexOf(data.method) > -1) {
		handlers._users[data.method](data, callback);
	} else {
		callback(405);
	}
};

// Container for the users submethods
handlers._users = {};

// Users - post
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = (data, callback) => {
	// Check that all required fields are filled out.
	const firstName =
		typeof data.payload.firstName == 'string' &&
		data.payload.firstName.trim().length > 0
			? data.payload.firstName.trim()
			: false;
	const lastName =
		typeof data.payload.lastName == 'string' &&
		data.payload.lastName.trim().length > 0
			? data.payload.lastName.trim()
			: false;
	const phone =
		typeof data.payload.phone == 'string' &&
		data.payload.phone.trim().length == 10
			? data.payload.phone.trim()
			: false;
	const password =
		typeof data.payload.password == 'string' &&
		data.payload.password.trim().length > 0
			? data.payload.password.trim()
			: false;
	const tosAgreement =
		typeof data.payload.tosAgreement == 'boolean' &&
		data.payload.tosAgreement == true
			? true
			: false;
	if (firstName && lastName && phone && password && tosAgreement) {
		// Make sure that the user doesn't already exist!
		_data.read('users', phone, (err, data) => {
			if (err) {
				// Hash the password
				const hashedPassword = helpers.hash(password);

				if (hashedPassword) {
					// Create the user object
					const user = {
						firstName,
						lastName,
						phone,
						hashedPassword,
						tosAgreement: true,
					};
					// Store the user

					_data.create('users', phone, user, err => {
						if (!err) {
							callback(200);
						} else {
							console.log(err);
							callback(500, { Error: 'Could not create the new user!' });
						}
					});
				} else {
					callback(500, { Error: "Could not hash the user's password!" });
				}
			} else {
				// user already exists
				callback(400, {
					Error: 'A user with that phone number already exists!',
				});
			}
		});
	} else {
		callback(400, { Error: 'Missing required fields!' });
	}
};

// Users - get
// Required data: phone
// Optional data: none
handlers._users.get = (data, callback) => {
	// Check that the phone number provided is valid
	const phone =
		typeof data.queryString.phone == 'string' &&
		data.queryString.phone.trim().length == 10
			? data.queryString.phone
			: false;

	if (phone) {
		// Get the token from the headers
		const token =
			typeof data.headers.token == 'string' ? data.headers.token : false;

		// Verify that the given token is valid  for the phone number
		handlers._tokens.verifyToken(token, phone, tokenIsValid => {
			if (tokenIsValid) {
				// Lookup the user
				_data.read('users', phone, (err, data) => {
					if (!err && data) {
						// Remove the hashedPassword from the user object before returning it to the requester
						delete data.hashedPassword;
						callback(200, data);
					} else {
						callback(404);
					}
				});
			} else {
				callback(403, {
					Error: 'Missing required token in header, or token is invalid!',
				});
			}
		});
	} else {
		callback(400, { Error: 'Missing required field!' });
	}
};

// Users - put
// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
handlers._users.put = (data, callback) => {
	// Check for the required field
	const phone =
		typeof data.payload.phone == 'string' &&
		data.payload.phone.trim().length == 10
			? data.payload.phone
			: false;

	// Check for the optional fields
	const firstName =
		typeof data.payload.firstName == 'string' &&
		data.payload.firstName.trim().length > 0
			? data.payload.firstName.trim()
			: false;
	const lastName =
		typeof data.payload.lastName == 'string' &&
		data.payload.lastName.trim().length > 0
			? data.payload.lastName.trim()
			: false;
	const password =
		typeof data.payload.password == 'string' &&
		data.payload.password.trim().length > 0
			? data.payload.password.trim()
			: false;

	// Error if the phone is invalid
	if (phone) {
		// Error if nothing is sent to update
		if (firstName || lastName || password) {
			// Get the token from the headers
			const token =
				typeof data.headers.token == 'string' ? data.headers.token : false;

			// Verify that the given token is valid  for the phone number
			handlers._tokens.verifyToken(token, phone, tokenIsValid => {
				if (tokenIsValid) {
					// Lookup the user
					_data.read('users', phone, (err, data) => {
						if (!err && data) {
							// update the fields necessary
							if (firstName) {
								data.firstName = firstName;
							}
							if (lastName) {
								data.lastName = lastName;
							}
							if (password) {
								data.hashedPassword = helpers.hash(password);
							}
							// Store the new updates
							_data.update('users', phone, data, err => {
								if (!err) {
									callback(200);
								} else {
									console.log(err);
									callback(500, { Error: 'Could not update the user!' });
								}
							});
						} else {
							callback(400, { Error: "The specified user doesn't exist" });
						}
					});
				} else {
					callback(403, {
						Error: 'Missing required token in header, or token is invalid!',
					});
				}
			});
		} else {
			callback(400, { Error: 'Missing fields to update!' });
		}
	} else {
		callback(400, { Error: 'Missing required field!' });
	}
};

// Users - delete
// Required data: phone
handlers._users.delete = (data, callback) => {
	// Check that the phone number provided is valid
	const phone =
		typeof data.queryString.phone == 'string' &&
		data.queryString.phone.trim().length == 10
			? data.queryString.phone
			: false;

	if (phone) {
		// Get the token from the headers
		const token =
			typeof data.headers.token == 'string' ? data.headers.token : false;

		// Verify that the given token is valid  for the phone number
		handlers._tokens.verifyToken(token, phone, tokenIsValid => {
			if (tokenIsValid) {
				// Lookup the user
				_data.read('users', phone, (err, data) => {
					if (!err && data) {
						_data.delete('users', phone, err => {
							if (!err) {
								// Delete each of the checks associated with the user
								const checks =
									typeof data.checks == 'object' && data.checks instanceof Array
										? data.checks
										: [];
										const checksToDelete = checks.length;
										if(checksToDelete > 0){
											let checksDeleted = 0;
											let deletionErrors = false;
											// Loop through the checks 
											checks.forEach(id => {
												// delete the check
												_data.delete('checks', id , err => {
													if (err){
														deletionErrors = true;
													}
													checksDeleted ++;
													if(checksDeleted == checksToDelete){
														if(!deletionErrors){
															callback(200)
														} else {
															callback(500, {
																Error: "Errors encountered while attempting to delete all of the user's checks. all checks may not have been deleted from the system successfully!",
															});
														}
													}
												})
											})
										}else {
											callback(200)
										}
							} else {
								callback(500, {
									Error: 'Could not delete the specified user!',
								});
							}
						});
					} else {
						callback(400, { Error: 'Could not find the specified user!' });
					}
				});
			} else {
				callback(403, {
					Error: 'Missing required token in header, or token is invalid!',
				});
			}
		});
	} else {
		callback(400, { Error: 'Missing required field!' });
	}
};

// Tokens handler
handlers.tokens = (data, callback) => {
	const acceptableMethods = ['post', 'get', 'put', 'delete'];
	if (acceptableMethods.indexOf(data.method) > -1) {
		handlers._tokens[data.method](data, callback);
	} else {
		callback(405);
	}
};

// Container for all the tokens methods
handlers._tokens = {};

// Tokens - post
// Required data: phone, password
// Optional data: none
handlers._tokens.post = (data, callback) => {
	const phone =
		typeof data.payload.phone == 'string' &&
		data.payload.phone.trim().length == 10
			? data.payload.phone.trim()
			: false;
	const password =
		typeof data.payload.password == 'string' &&
		data.payload.password.trim().length > 0
			? data.payload.password.trim()
			: false;
	if (phone && password) {
		// Lookup the user who matches that phone number
		_data.read('users', phone, (err, data) => {
			if (!err && data) {
				// Hash the sent password, and compare it to the password stored in the user object
				const hashedPassword = helpers.hash(password);

				if (hashedPassword == data.hashedPassword) {
					// If valid, create a new token with random name, set expiration date 1 hour in the future
					const id = helpers.createRandomString(20);
					const expires = Date.now() + 1000 * 60 * 60;
					const token = {
						phone,
						id,
						expires,
					};
					// Store the token
					_data.create('tokens', id, token, err => {
						if (!err) {
							callback(200, token);
						} else {
							callback(500, { Error: 'Could not create the new token!' });
						}
					});
				} else {
					callback(400, {
						Error: "Password didn't match the specified user's stored password",
					});
				}
			} else {
				callback(400, { Error: 'Could nor find the specified user!' });
			}
		});
	} else {
		callback(400, { Error: 'Missing required fields!' });
	}
};
// Tokens - get
// Required data: id
// optional data : none
handlers._tokens.get = (data, callback) => {
	// check that the id is valid
	const id =
		typeof data.queryString.id == 'string' &&
		data.queryString.id.trim().length == 20
			? data.queryString.id
			: false;
	if (id) {
		// Lookup the token
		_data.read('tokens', id, (err, data) => {
			if (!err && data) {
				callback(200, data);
			} else {
				callback(404);
			}
		});
	} else {
		callback(400, { Error: 'Missing required field!' });
	}
};

// Tokens - put
// Required data: id, extend
// optional data: none
handlers._tokens.put = (data, callback) => {
	const id =
		typeof data.payload.id == 'string' && data.payload.id.trim().length == 20
			? data.payload.id.trim()
			: false;
	const extend =
		typeof data.payload.extend == 'boolean' && data.payload.extend == true
			? true
			: false;
	if (id && extend) {
		// Lookup the token
		_data.read('tokens', id, (err, data) => {
			if (!err && data) {
				// Check to make sure the token isn't already expired
				if (data.expires > Date.now()) {
					// Set the expiration an hour from now
					data.expires = Date.now() + 1000 * 60 * 60;
					// Store the new updates
					_data.update('tokens', id, data, err => {
						if (!err) {
							callback(200);
						} else {
							callback(500, {
								Error: "Could not update the token's expiration!",
							});
						}
					});
				} else {
					callback(400, {
						Error: 'Token has already expired and cannot be extended!',
					});
				}
			} else {
				callback(400, { Error: 'Specified token does not exist!' });
			}
		});
	} else {
		callback(400, { Error: 'Missing required fields or fields are invalid!' });
	}
};

// Tokens - delete
// Required data: id
// optional data: none
handlers._tokens.delete = (data, callback) => {
	// Check that the id number provided is valid
	const id =
		typeof data.queryString.id == 'string' &&
		data.queryString.id.trim().length == 20
			? data.queryString.id
			: false;

	if (id) {
		// Lookup the user
		_data.read('tokens', id, (err, data) => {
			if (!err && data) {
				_data.delete('tokens', id, err => {
					if (!err) {
						callback(200);
					} else {
						callback(500, { Error: 'Could not delete the specified token!' });
					}
				});
			} else {
				callback(400, { Error: 'Could not find the specified token!' });
			}
		});
	} else {
		callback(400, { Error: 'Missing required field!' });
	}
};

// Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = (id, phone, callback) => {
	// Lookup the token
	_data.read('tokens', id, (err, data) => {
		if ((!err, data)) {
			// Check that the token is for a given user and has not expired
			if (data.phone == phone && data.expires > Date.now()) {
				callback(true);
			} else {
				callback(false);
			}
		} else {
			callback(false);
		}
	});
};

// Checks handler
handlers.checks = (data, callback) => {
	const acceptableMethods = ['post', 'get', 'put', 'delete'];
	if (acceptableMethods.indexOf(data.method) > -1) {
		handlers._checks[data.method](data, callback);
	} else {
		callback(405);
	}
};

// Container for all the Checks methods
handlers._checks = {};

// Checks - post
// Required data: protocol, url, method, successCodes, timeoutSeconds
// Optional data: none
handlers._checks.post = (data, callback) => {
	// Validate all these inputs
	const protocol =
		typeof data.payload.protocol == 'string' &&
		['https', 'http'].indexOf(data.payload.protocol) > -1
			? data.payload.protocol
			: false;
	const url =
		typeof data.payload.url == 'string' && data.payload.url.trim().length > 0
			? data.payload.url.trim()
			: false;
	const method =
		typeof data.payload.method == 'string' &&
		['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1
			? data.payload.method
			: false;
	const successCodes =
		typeof data.payload.successCodes == 'object' &&
		data.payload.successCodes instanceof Array &&
		data.payload.successCodes.length > 0
			? data.payload.successCodes
			: false;
	const timeoutSeconds =
		typeof data.payload.timeoutSeconds == 'number' &&
		data.payload.timeoutSeconds % 1 === 0 &&
		data.payload.timeoutSeconds >= 1 &&
		data.payload.timeoutSeconds <= 5
			? data.payload.timeoutSeconds
			: false;
	if (protocol && url && method && successCodes && timeoutSeconds) {
		// Get the token from the header
		const token =
			typeof data.headers.token == 'string' ? data.headers.token : false;
		// lookup the user by reading the token
		_data.read('tokens', token, (err, data) => {
			if (!err && data) {
				const phone = data.phone;

				// lookup the user
				_data.read('users', phone, (err, data) => {
					if (!err && data) {
						const checks =
							typeof data.checks == 'object' && data.checks instanceof Array
								? data.checks
								: [];
						// Verify that the user has less the number of max-checks-per-user
						if (checks.length < config.maxChecks) {
							// Create a random id for the check
							const id = helpers.createRandomString(20);
							// Create the check object and include the user's phone
							const check = {
								id,
								phone,
								protocol,
								url,
								method,
								successCodes,
								timeoutSeconds,
							};
							// Save the check object
							_data.create('checks', id, check, err => {
								if (!err) {
									// Add the check id to the users object
									data.checks = checks;
									data.checks.push(id);
									// Save the new user data
									_data.update('users', phone, data, err => {
										if (!err) {
											// Return the data about the new check
											callback(200, check);
										} else {
											callback(500, {
												Error: 'Could not update the user with the new check!',
											});
										}
									});
								} else {
									callback(500, { Error: 'Could not create the new check!' });
								}
							});
						} else {
							callback(400, {
								Error:
									'The user already has the maximum number of checks (' +
									config.maxChecks +
									')',
							});
						}
					} else {
						callback(403);
					}
				});
			} else {
				callback(403);
			}
		});
	} else {
		callback(400, { Error: 'Missing required inputs, or inputs are invalid!' });
	}
};

// Checks - get
// Required data: id
// Optional data: none
handlers._checks.get = (data, callback) => {
	// Check that the phone number provided is valid
	const id =
		typeof data.queryString.id == 'string' &&
		data.queryString.id.trim().length == 20
			? data.queryString.id.trim()
			: false;

	if (id) {
		// Lookup the check
		_data.read('checks', id, (err, checkData) => {
			if (!err && checkData) {
				// Get the token from the headers
				const token =
					typeof data.headers.token == 'string' ? data.headers.token : false;

				// Verify that the given token is valid and belongs to the user who created the check
				handlers._tokens.verifyToken(token, checkData.phone, tokenIsValid => {
					if (tokenIsValid) {
						// Return the check data
						callback(200, checkData);
					} else {
						callback(403);
					}
				});
			} else {
				callback(404);
			}
		});
	} else {
		callback(400, { Error: 'Missing required field!' });
	}
};

// Checks - put
// Required data: id
// Optional data: protocol, url, method, successCodes, timeoutSeconds (one must be sent)
handlers._checks.put = (data, callback) => {
	// Check for the required field
	const id =
		typeof data.payload.id == 'string' && data.payload.id.trim().length == 20
			? data.payload.id.trim()
			: false;

	//  Check for the optional fields
	const protocol =
		typeof data.payload.protocol == 'string' &&
		['https', 'http'].indexOf(data.payload.protocol) > -1
			? data.payload.protocol
			: false;
	const url =
		typeof data.payload.url == 'string' && data.payload.url.trim().length > 0
			? data.payload.url.trim()
			: false;
	const method =
		typeof data.payload.method == 'string' &&
		['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1
			? data.payload.method
			: false;
	const successCodes =
		typeof data.payload.successCodes == 'object' &&
		data.payload.successCodes instanceof Array &&
		data.payload.successCodes.length > 0
			? data.payload.successCodes
			: false;
	const timeoutSeconds =
		typeof data.payload.timeoutSeconds == 'number' &&
		data.payload.timeoutSeconds % 1 === 0 &&
		data.payload.timeoutSeconds >= 1 &&
		data.payload.timeoutSeconds <= 5
			? data.payload.timeoutSeconds
			: false;
	if (id) {
		// Check to make sure ne or more optional fields has been sent
		if (protocol || url || method || successCodes || timeoutSeconds) {
			// Lookup the check
			_data.read('checks', id, (err, checkData) => {
				if ((!err, checkData)) {
					const token =
						typeof data.headers.token == 'string' ? data.headers.token : false;

					// Verify that the given token is valid and belongs to the user who created the check
					handlers._tokens.verifyToken(token, checkData.phone, tokenIsValid => {
						if (tokenIsValid) {
							// Update the check where necessary
							if (protocol) {
								checkData.protocol = protocol;
							}
							if (url) {
								checkData.url = url;
							}
							if (method) {
								checkData.method = method;
							}
							if (successCodes) {
								checkData.successCodes = successCodes;
							}
							if (timeoutSeconds) {
								checkData.timeoutSeconds = timeoutSeconds;
							}
							// Store the new updates
							_data.update('checks', id, checkData, err => {
								if (!err) {
									callback(200);
								} else {
									callback(500, { Error: 'Could not update the check' });
								}
							});
						} else {
							callback(403);
						}
					});
				} else {
					callback(400, { Error: 'Check ID did not exist!' });
				}
			});
		} else {
			callback(400, { Error: 'Missing fields to update!' });
		}
	} else {
		callback(400, { Error: 'Missing required field!' });
	}
};

// Checks - delete
// Required data: id
// optional data: none
handlers._checks.delete = (data, callback) => {
	// Check that the id provided is valid
	const id =
		typeof data.queryString.id == 'string' &&
		data.queryString.id.trim().length == 20
			? data.queryString.id
			: false;

	if (id) {
		// Lookup the check
		_data.read('checks', id, (err, checkData) => {
			if (!err && checkData) {
				// Get the token from the headers
				const token =
					typeof data.headers.token == 'string' ? data.headers.token : false;

				// Verify that the given token is valid  for the phone number
				handlers._tokens.verifyToken(token, checkData.phone, tokenIsValid => {
					if (tokenIsValid) {
						// Delete the check data
						_data.delete('checks', id, err => {
							if (!err) {
								// Lookup the user
								_data.read('users', checkData.phone, (err, data) => {
									if (!err && data) {
										const checks =
											typeof data.checks == 'object' &&
											data.checks instanceof Array
												? data.checks
												: [];
										// Remove the deleted check from their list of checks
										const checkPosition = checks.indexOf(id);
										if (checkPosition > -1) {
											checks.splice(checkPosition, 1);
											// Re-save the user's data
											_data.update('users', checkData.phone, data, err => {
												if (!err) {
													callback(200);
												} else {
													callback(500, {
														Error: 'Could not update the user!',
													});
												}
											});
										} else {
											callback(500, {
												Error:
													'Could not find the check on the user object, so could not remove it!',
											});
										}
									} else {
										callback(500, {
											Error:
												'Could not find the user who created the check, so could not remove the check from the list of checks from the user object!',
										});
									}
								});
							} else {
								callback(400, { Error: 'Could not delete the check data' });
							}
						});
					} else {
						callback(403);
					}
				});
			} else {
				callback(400, { Error: 'The specified check ID does not exist!' });
			}
		});
	} else {
		callback(400, { Error: 'Missing required field!' });
	}
};
// ping handler
handlers.ping = (data, callback) => {
	// callback http status code, and a payload object
	callback(200);
};

// Not found  handler
handlers.notFound = (data, callback) => {
	callback(404);
};

// Exporting module
module.exports = handlers;

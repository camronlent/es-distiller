var Transform   = require("stream").Transform,
	PassThrough = require("stream").PassThrough,
	util        = require("util");

util.inherits(Distillery, PassThrough);
util.inherits(Distiller, Transform);
util.inherits(Condenser, Transform);
util.inherits(Parser, Transform);

module.exports = Distillery;

/**
 * The PassThrough stream that creates the distillation process.
 * @param options The options for the PassThrough and Transform streams.
 * @returns Distillery A transform stream representing the distillation process.
 * @constructor
 */
function Distillery (options)
{
	if (!(this instanceof Distillery))
	{
		return new Distillery(options);
	}

	var _this = this;
	this._distillChain = undefined;

	// TODO: Find out the right place to specify this.
	// Enforce default mode to objectMode
	options.objectMode = options.objectMode || true;

	// TODO: Research when/how this is triggered with the pipe function override.
	this.on("pipe", function (source)
	{
		// TODO: Research why this is necessary, I don't fully understand it yet.
		source.unpipe(this);

		// TODO: Research best error propogation, I susspect that re-emission isn't the right answer.
		this._distillChain = source
			.pipe(new Distiller(options))
			.on("error", function (error)
			{
				_this.emit("error", error);
			})
			.pipe(new Condenser(options))
			.on("error", function (error)
			{
				_this.emit("error", error);
			});
	});

	PassThrough.call(this, options);
}

/**
 * Override the pipe function to chain the transform streams instead.
 * @param dest The destination stream.
 * @param options The options to pass into the transform streams.
 */
Distillery.prototype.pipe = function (dest, options)
{
	return this._distillChain.pipe(dest, options);
};

/**
 * The Transform stream responsible for parsing includes.
 * @param options
 * @constructor
 */
function Distiller (options)
{
	Transform.call(this, options);
}

/**
 * The transform override.
 * @param data The data that was written into the stream
 * @param encoding The encoding of said data
 * @param done The callback to use when finished processing the data
 */
Distiller.prototype._transform = function (data, encoding, done)
{
	this.push(data);
	done();
};

/**
 * Exception recieved when the condenser fails.
 * @param message The message from the condenser.
 * @constructor
 */
function CondenserException (message)
{
	this.message = message;
	this.name = "CondenserException";
}

/**
 * Convert the exception to a string
 */
CondenserException.prototype.toString = function ()
{
	return this.name + ": \"" + this.message + "\"";
};

/**
 * The transform stream that replaces marked areas with the associated data.
 * @param options The data attribute is what's used to match keys.
 * @constructor
 */
function Condenser (options)
{
	this.data = (options && options.hasOwnProperty("data"))
		? options.data
		: {};

	this.isOpen = false;
	this.isClosed = false;
	this.contents = [];
	this.queue = [];

	var _this = this;
	this.parser = new Parser(options);

	this.parser.on("data", function (data)
	{
		_this.push(data);
	});

	this.parser.on("error", function (error)
	{
		_this.emit("error", error);
	});

	Transform.call(this, options);
}

/**
 * Parses the incoming data. Replaces marked areas using the data passed into the options.
 * @param data The data to be parsed.
 * @param encoding The encoding of said data.
 * @param done The callback once finished parsing the data passed.
 * @private
 */
Condenser.prototype._transform = function (data, encoding, done)
{
	// TODO: Research the possibility of data.toString() failing because of "half-characters"
	// NOTE: Object Mode forces stream to UTF-8. I assume that means that it won't ever be given a chunk
	// that does not contain all of the bytes necessary to represent a character. But I also susspect that
	// assumption doesn't make sense.
	var str = data.toString();

	// NOTE: it may become useful to define the open, close, and escape, characters through options.
	var tokenEscape = "\\";
	var tokenOpen = "{";
	var tokenClose = "}";

	try
	{
		// loop through each character
		for (var i = 0; i < str.length; i++)
		{
			// not in a marked area.
			if (this.isOpen === false)
			{
				tokenSearch.call(this, str[i], tokenOpen, tokenEscape,
					// when the token has been seen twice
					function ()
					{
						this.isOpen = true;
					},
					// when the token has not been seen twice yet.
					function (char)
					{
						this.push(char);
					}
				);
			}
			// in an open marked area.
			else if (this.isOpen === true)
			{
				tokenSearch.call(this, str[i], tokenClose, tokenEscape,
					// when the token has been seen twice
					function ()
					{
						this.isOpen = false;
						this.parser.finalize();
					},
					// when the token has not been seen twice yet.
					function (char)
					{
						// Note: this is actually unnecessary, but without it people don't get errors... which leads
						// to templates silently failing...
						if (char === tokenOpen || char === tokenClose)
						{
							throw new CondenserException("es-distiller: condenser failed.");
						}
						this.parser.write(char);
					}
				);
			}
		}

		// finished with this chunk
		done();
	}
	catch (exception)
	{
		// an error occurred
		done(exception);
	}
};

/**
 * Handle actions that happen when the stream is done, but the state is invalid or there is data left to push.
 * @param done The callback to call when there's nothing left to do.
 * @private
 */
Condenser.prototype._flush = function (done)
{
	if (this.isOpen == true && this.isClosed === false)
	{
		// TODO: sensible error output
		done(new CondenserException("es-distiller: condenser failed, invalid ending marker."));
	}
	else
	{
		// Push any "unfinished business" into the buffer
		if (this.queue.length === 1)
		{
			this.push(this.queue.shift());
		}
		done();
	}
};

/**
 * Exception recieved when the parser fails.
 * @param message The message from the parser.
 * @constructor
 */
function ParserException (message)
{
	this.message = message;
	this.name = "ParserException";
}

/**
 * Generate a string representation of the error.
 */
ParserException.prototype.toString = function ()
{
	return this.name + ": \"" + this.message + "\"";
};

/**
 * The stream responsible for tracing an expression to it's data representation.
 * @param options
 * @constructor
 */
function Parser (options)
{
	this.data = (options && options.hasOwnProperty("data"))
		? options.data
		: {};

	this.isStarted = false;
	this.expr = [];
	this.queue = [];

	Transform.call(this, options);
}

/**
 * The transform stream operation
 * @param The data written into the stream
 * @param encoding The encoding of said data
 * @param done The callback to use when done processing data.
 */
Parser.prototype._transform = function (data, encoding, done)
{
	var str = data.toString();
	var queued = null;
	for (var i = 0; i < str.length; i++)
	{
		if (this.isStarted === true)
		{
			if (!isWhiteSpace(str[i]))
			{
				while (queued = this.queue.shift())
				{
					this.expr.push(queued);
				}

				this.expr.push(str[i]);
			}
			else
			{
				this.queue.push(str[i]);
			}
		}
		else
		{
			// ignore to trim the beginning of white-space characters.
			if (!isWhiteSpace(str[i]))
			{
				this.expr.push(str[i]);
				this.isStarted = true;
			}
		}
	}

	done();
};

/**
 * Let the parser know when the expression has ended.
 * Evaluates expression, and attempts to output the data.
 */
Parser.prototype.finalize = function ()
{
	if (!this.isStarted)
	{
		return;
	}

	this.isStarted = false;
	this.queued = null;
	this.queue.splice(0, this.queue.length);

	// aggregate expression.
	var expr = this.expr.join("");
	this.expr.splice(0, this.expr.length);

	// evaluate expression
	var keys = evaluate(expr);
	var data = this.data;

	for (var i = 0; i < keys.length; i++)
	{
		if (keys[i] in data)
		{
			data = data[keys[i]];
		}
		else
		{
			throw new CondenserException(keys[i] + " key not found.");
		}
	}

	this.push(data);
};

/**
 * Check if a character is a whitespace character or not
 * @param char The character to test for whitespace
 * NOTE: this function may change beyond a regular regex as this
 * code becomes more used.
 */
function isWhiteSpace(char)
{
	return /\s/.test(char);
}

/**
 * Abstraction to looking for the token twice, taking into account escaped tokens.
 * @this Parser The parser responsible for searching for the token.
 * @param cur The current character
 * @param token The token we're looking for twice
 * @param escape The character to escape the token
 * @param cbActivate The callback if the token was found twice
 * @param cbAction The callback to handle the given character until token found
 */
function tokenSearch (cur, token, escape, cbActivate, cbAction)
{
	if (cur === token || cur === escape)
	{
		this.queue.push(cur);
	}

	if (this.queue.length == 2)
	{
		switch (this.queue.join(""))
		{
			case token + token:
				cbActivate.call(this);
				this.queue.splice(0, 2);
				break;
			case escape + token:
				cbAction.call(this, token);
				this.queue.splice(0, 2);
				break;
			case token + escape:
			case escape + escape:
				cbAction.call(this, this.queue.shift());
				break;
		}
	}
	else if (cur !== token && cur !== escape)
	{
		if (this.queue.length === 1)
		{
			cbAction.call(this, this.queue.shift());
		}
		cbAction.call(this, cur);
	}
}

/**
 * Evaluate expression and return array representing parts
 * @param expr The expression to evaluate
 */
function evaluate (expr)
{
	"use strict";
	var quote = false;
	var keys = [];
	var tmpKey = [];
	var c = "";
	var i = 0, k = 0;
	var escaped;

	// step 1: determine if it's wrapped in quotes, and if so which quote character is used.
	if (/^(["']).+[^\\]\1$/.test(expr))
	{
		quote = expr[0];
		expr = expr.substr(1, expr.length - 2);
	}

	// step 2: determine if it's is empty.
	if (expr.length === 0 /*|| expr[0] === "\"" || expr[0] === "'"*/)
	{
		throw new ParserException("the expression was empty.");
	}

	// step 3: if not quoted, check for invalid spaces.
	if (!quote && /\s/.test(expr))
	{
		throw new ParserException("expression contains one or more white space characters, but is not wrapped in quotes.");
	}

	// step 4: check for invalid unescaped quotes.
	// -.- no look-behind in regexes.
	if (!!quote)
	{
		// is quoted (only the <quote> character needs to be escaped)
		c = "";
		for (i = 0; i < expr.length; i++)
		{
			if (expr[i] === quote && c !== "\\")
			{
				throw new ParserException("expression contains unescaped quotation marks.");
			}
			c = expr[i];
		}
	}
	else
	{
		// not quoted (require both " and ' to be escaped)
		c = "";
		for (i = 0; i < expr.length; i++)
		{
			if ((expr[i] === "\"" || expr[i] === "'") && c !== "\\")
			{
				throw new ParserException("expression contains unescaped quotation marks.");
			}
			c = expr[i];
		}
	}

	// step 5: validate "." placement.
	// -.- no look-behind in regexes.
	c = "";
	escaped = false;
	for (i = 0; i < expr.length; i++)
	{
		if (i === 0 && expr[i] === ".")
		{
			throw new ParserException("expression can not start with a \".\"");
		}
		else if (expr[i] === "." && c === "\\")
		{
			escaped = true;
		}
		else if (expr[i] === "." && c === "." && escaped === false)
		{
			throw new ParserException("expression can not contain two \".\"s next to each other.")
		}
		else
		{
			escaped = false;
		}
		c = expr[i];
	}
	if (c === "." && escaped === false)
	{
		throw new ParserException("expression can not end with a \".\".");
	}

	// step 6: split into keys.
	c = "";
	tmpKey.splice(0, tmpKey.length);
	for (i = 0; i < expr.length; i++)
	{
		if (expr[i] === "." && c !== "\\")
		{
			keys.push(tmpKey.join(""));
			tmpKey.splice(0, tmpKey.length);
		}
		else
		{
			tmpKey.push(expr[i]);
		}
		c = expr[i];
	}
	if (tmpKey.length > 0)
	{
		keys.push(tmpKey.join(""));
	}

	// step 7: un-escape keys
	for (i = 0; i < keys.length; i++)
	{
		c = "";
		tmpKey.splice(0, tmpKey.length);
		for (k = 0; k < keys[i].length; k++)
		{
			if ((
				keys[i][k] === "."
				|| (!!quote && keys[i][k] === quote)
				|| (!quote && (keys[i][k] === "\"" || keys[i][k] === "'"))
			) && c === "\\"
			|| (keys[i][k] !== "\\" && c !== "\\"))
			{
				tmpKey.push(keys[i][k]);
			}
			else if(keys[i][k] === "\\" && c === "\\")
			{
				tmpKey.push(c);
			}
			else if(c === "\\")
			{
				tmpKey.push(c);
				tmpKey.push(keys[i][k]);
			}

			c = keys[i][k];
		}
		keys[i] = tmpKey.join("");
	}

	return keys;
}


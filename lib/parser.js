"use strict";

var Transform = require("stream").Transform,
	util = require("util"),
	libUtils = require("./utils.js");

util.inherits(Parser, Transform);
module.exports = Parser;

/**
 * Exception recieved when the parser fails.
 * @param message The message from the parser.
 * @constructor
 */
function ParserException(message)
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
function Parser(options)
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
 * @param data The data written into the stream
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
			if (!libUtils.isWhiteSpace(str[i]))
			{
				do
				{
					queued = this.queue.shift();
					this.expr.push(queued);
				}
				while(queued);

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
			if (!libUtils.isWhiteSpace(str[i]))
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
	//this.queued = null;
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
			throw new ParserException(keys[i] + " key not found.");
		}
	}

	this.push(data);
};

/**
 * Evaluate expression and return array representing parts
 * @param expr The expression to evaluate
 */
function evaluate(expr)
{
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
	// -.- no look-behind in regexps.
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
			throw new ParserException("expression can not contain two \".\"s next to each other.");
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
			else if (keys[i][k] === "\\" && c === "\\")
			{
				tmpKey.push(c);
			}
			else if (c === "\\")
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
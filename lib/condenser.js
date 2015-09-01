var Transform = require("stream").Transform,
	util = require("util"),
	Parser = require("./parser.js"),
	libUtils = require("./utils.js");

util.inherits(Condenser, Transform);
module.exports = Condenser;

/**
 * Exception recieved when the condenser fails.
 * @param message The message from the condenser.
 * @constructor
 */
function CondenserException(message)
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
function Condenser(options)
{
	this.data = (options && options.hasOwnProperty("data"))
		? options.data
		: {};

	this.isOpen = false;
	this.isClosed = false;
	this.contents = [];
	this.queue = {};

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
	// that does not contain all of the bytes necessary to represent a utf-8 character. But I also suspect that
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
				libUtils.tokenSearch.call(this, "begin-1", str[i], tokenOpen, tokenEscape,
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
				libUtils.tokenSearch.call(this, "begin-2", str[i], tokenOpen, tokenEscape,
					function ()
					{
						// if we find a beginning tag that's not escaped, the distiller step before has failed.
						throw new CondenserException("es-distiller: distiller failed.");
					},
					function (char)
					{
						libUtils.tokenSearch.call(this, "end", char, tokenClose, tokenEscape,
							// when the token has been seen twice
							function ()
							{
								this.isOpen = false;
								this.parser.finalize();
							},
							// when the token has not been seen twice yet.
							function (char)
							{
								this.parser.write(char);
							}
						);
					});
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
		// NOTE: This shouldn't happen unless the last character is a '{' or '}'

		// TODO: Evaluate if this is actually the right place to do this
		// TODO: Evaluate if this is the right "thing" to do.

		// Push any "unfinished business" into the buffer
		var keys = Object.keys(this.queue);
		for (var i = 0; i < keys.length; i++)
		{
			if (this.queue[keys[i]].length === 1)
			{
				this.push(this.queue[keys[i]].shift());
			}
		}
		done();
	}
};
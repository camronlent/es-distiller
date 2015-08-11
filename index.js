var Transform   = require("stream").Transform,
	PassThrough = require("stream").PassThrough,
	util        = require("util");

util.inherits(Distillery, PassThrough);
util.inherits(Distiller, Transform);
util.inherits(Condenser, Transform);

module.exports = Distillery;

/**
 * The PassThrough stream that creates the distillation process.
 * @param options The options for the PassThrough and Transform streams.
 * @returns A transform stream representing the distillation process.
 * @constructor
 */
function Distillery (options)
{
	if (!(this instanceof Distillery))
	{
		return new Distillery(options);
	}

	var _this = this;
	this._distilleryProcess = undefined;
	options.objectMode = options.objectMode || true;

	this.on("pipe", function (source)
	{
		source.unpipe(this);

		this._distilleryProcess = source
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
}

Distillery.prototype.pipe = function (dest, options)
{
	return this._distilleryProcess.pipe(dest, options);
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

Distiller.prototype._transform = function (data, encoding, done)
{
	this.push(data);
	done();
	// done(null, data);
};

function CondenserException (message)
{
	this.message = message;
	this.name = "CondenserException";
}
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
	this.data = (options)
		? options.data || {}
		: {};

	this.refopen = false;
	this.refclose = false;
	this.refkey = [];

	this.prev = "";

	Transform.call(this, options);
}

/**
 * Abstraction to comparing the last character seen, to the current character.
 * Looks to see two tokens in a row, includes escaping and simplifies writing the token if there aren't two in a row.
 * @param cur the current character.
 * @param token the token we're looking for two of.
 * @param escape the escape token.
 * @param cbActivate the callback for successfully seeing two tokens in a row.
 * @param cbAction the action to take otherwise.
 * @private
 */
Condenser.prototype._parseAbstraction = function (cur, token, escape, cbActivate, cbAction)
{
	// if the current and previous characters are the token
	if (cur === token && this.prev === token)
	{
		cbActivate.call(this);
	}
	// if the current character is the token, but the previous token is an escape
	else if (cur === token && this.prev === escape)
	{
		cbAction.call(this, cur);
		cur = "";
	}
	else if (cur === escape && this.prev === token)
	{
		cbAction.call(this, this.prev);
	}
	else if (cur === escape && this.prev === escape)
	{
		cbAction.call(this, cur);
	}
	// we saw the token, wait to see if we get it again
	else if (cur === token || cur === escape)
	{
		// no op
	}
	else
	{
		// if the previous character is the token, then the current character can not be
		// threrefore it is unnecessarily withheld, and should be acted upon.
		if (this.prev === token ||
			this.prev === escape && cur !== token)
		{
			cbAction.call(this, this.prev);
		}
		cbAction.call(this, cur);
	}
	// set the last character seen
	this.prev = cur;
};

/**
 * Transform override, parses the incomming data, and replaces marked areas using the data passed into the condenser.
 * @param data The data available
 * @param encoding The encoding of said data
 * @param done The callback once finished
 * @private
 */
Condenser.prototype._transform = function (data, encoding, done)
{
	// TODO: Research the possibility of data.toString() failing because of "half-characters"
	var str = data.toString();

	// NOTE: it may become useful to define the open, close, and escape, characters through options.
	var parseFailed = false;
	var tokenEscape = "\\";
	var tokenOpen = "{";
	var tokenClose = "}";

	// loop through each character
	for (var i = 0; i < str.length && parseFailed === false; i++)
	{
		// not in a marked area.
		if (this.refopen === false && this.refclose === false)
		{
			this._parseAbstraction(str[i], tokenOpen, tokenEscape,
				// when the token has been seen twice
				function ()
				{
					this.refopen = true;
				},
				// when the token has not been seen twice yet.
				function (char)
				{
					this.push(char);
				});
		}
		// in an open marked area.
		else if (this.refopen === true && this.refclose === false)
		{
			this._parseAbstraction(str[i], tokenClose, tokenEscape,
				// when the token has been seen twice
				function ()
				{
					this.refclose = true;
				},
				// when the token has not been seen twice yet.
				function (char)
				{
					if (char === tokenOpen || char === tokenClose)
					{
						parseFailed = true;
						return;
					}
					this.refkey.push(char);
				}
			);
		}

		// finished collecting the key from the marked area.
		if (this.refopen === true && this.refclose == true)
		{
			var key = this.refkey.join("").trim();
			if (key in this.data)
			{
				this.push(this.data[key]);
			}
			else
			{
				this.push(tokenOpen + tokenOpen + key + tokenClose + tokenClose);
			}
			this.refopen = false;
			this.refclose = false;
		}
	}

	// finished with this chunk
	if (parseFailed)
	{
		// TODO: sensible error output
		done(new CondenserException("es-distiller: condenser failed, invalid marker used."));
	}
	else
	{
		done();
	}
};

Condenser.prototype._flush = function (done)
{
	if (this.refopen == true && this.refclose === false)
	{
		// TODO: sensible error output
		done(new CondenserException("es-distiller: condenser failed, invalid ending marker."));
	}
	else
	{
		done();
	}
};

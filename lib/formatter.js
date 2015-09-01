"use strict";

var Transform = require("stream").Transform,
	util = require("util");

util.inherits(Formatter, Transform);
module.exports = Formatter;

/**
 * Transform stream to un-escape tokens
 * @param options
 * @constructor
 */
function Formatter(options)
{
	this.queue = [];
	Transform.call(this, options);
}

/**
 *
 * @param data
 * @param encoding
 * @param done
 * @private
 */
Formatter.prototype._transform = function (data, encoding, done)
{
	var i, scope,
		str = data.toString(),
		tokenA = "\\{",
		tokenB = "\\}";

	for (i = 0; i < str.length; i++)
	{
		this.queue.push(str[i]);
		if (this.queue.length === 2)
		{
			scope = this.queue.join("");
			switch (scope)
			{
				case tokenA:
				case tokenB:
					this.push(this.queue.pop());
					this.queue.pop();
					break;
				default:
					this.push(this.queue.shift());
					break;
			}
		}
	}
	done();
};

Formatter.prototype._flush = function (done)
{
	if (this.queue.length > 0)
	{
		this.push(this.queue.shift());
	}
	done();
};
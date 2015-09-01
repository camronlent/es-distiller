var Transform = require("stream").Transform,
	util = require("util");

util.inherits(Distiller, Transform);
module.exports = Distiller;

/**
 * The Transform stream responsible for parsing includes.
 * @param options
 * @constructor
 */
function Distiller(options)
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

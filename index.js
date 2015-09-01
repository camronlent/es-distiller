var PassThrough = require("stream").PassThrough,
	util = require("util"),
	Distiller = require("./lib/distiller.js"),
	Condenser = require("./lib/condenser.js"),
	Formatter = require("./lib/formatter.js");

util.inherits(Distillery, PassThrough);
module.exports = Distillery;

/**
 * The PassThrough stream that creates the distillation process.
 * @param options The options for the PassThrough and Transform streams.
 * @returns Distillery A transform stream representing the distillation process.
 * @constructor
 */
function Distillery(options)
{
	if (!(this instanceof Distillery))
	{
		return new Distillery(options);
	}

	var _this = this;
	this._distillChain = undefined;

	// TODO: Research object mode and non-object mode.
	// TODO: Evaluate for correctness of object vs non-object mode.

	// Enforce default mode to objectMode
	options.objectMode = options.objectMode || true;

	// TODO: Research when/how this is triggered with the pipe function override.
	this.on("pipe", function (source)
	{
		// TODO: Research why this is necessary, I don't fully understand it yet.
		source.unpipe(this);

		// TODO: Research best error propagation, I suspect that re-emission isn't the right answer.
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
			})
			.pipe(new Formatter(options));
	});

	PassThrough.call(this, options);
}

/**
 * Override the pipe function to chain the transform streams instead.
 * @param destination The destination stream.
 * @param options The options to pass into the transform streams.
 */
Distillery.prototype.pipe = function (destination, options)
{
	return this._distillChain.pipe(destination, options);
};


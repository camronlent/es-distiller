var assert     = require("assert"),
	stream     = require("stream"),
	util       = require("util"),
	distillery = require("..\/");

// Verifiable Output Container
/**
 * A stream that can be written to, and allowing access to the contents via .toString() override
 * @param options The options to pass into the writable stream constructor.
 * @constructor
 */
function StringAbleStream (options)
{
	stream.Writable.call(this, options);
	this.buffer = [];
}
util.inherits(StringAbleStream, stream.Writable);

/**
 * Stores string into an internal buffer.
 * @param data The data to be written into the buffer.
 * @param encoding The encoding of said data.
 * @param done The callback to call once the data has been stored.
 * @private
 */
StringAbleStream.prototype._write = function (data, encoding, done)
{
	this.buffer.push(data);
	done();
};

/**
 * Converts the contents of the buffer into a string, and then returns it.
 * @returns {String}
 */
StringAbleStream.prototype.toString = function ()
{
	return Buffer.concat(this.buffer).toString();
};

describe("Distillery", function ()
{
	describe("condenser-tests", function ()
	{
		var templates = [
			// expression definition syntax
			["simple variable 1", "Hello {{ name }}, how are you?", {name: "bob"}, "Hello bob, how are you?"],
			["simple variable 2", "Hello {{ name}}, how are you?", {name: "bob"}, "Hello bob, how are you?"],
			["simple variable 3", "Hello {{name }}, how are you?", {name: "bob"}, "Hello bob, how are you?"],
			["simple variable 4", "Hello {{name}}, how are you?", {name: "bob"}, "Hello bob, how are you?"],
			["escape sequence 1", "Hello {\\{ name }}, how are you?", undefined, "Hello {{ name }}, how are you?"],
			["escape sequence 5", "Hello \\{{ name }}, how are you?", {name: "bob"}, "Hello {{ name }}, how are you?"],
			["escape sequence 2", "Hello \\ {\\{ name }}, how are you?", undefined, "Hello \\ {{ name }}, how are you?"],
			["escape sequence 3", "Hello \\ {\\\\{ name }}, how are you?", undefined, "Hello \\ {\\{ name }}, how are you?"],
			["escape sequence 4", "Hello \\ {\\\\\\{ name }}, how are you?", undefined, "Hello \\ {\\\\{ name }}, how are you?"],
			["escape sequence 6", "Hello \\\\", undefined, "Hello \\\\"],
			["invalid marker 1", "Hello {{ n}ame }}, how are you?", {name: "bob"}],
			["invalid marker 2", "Hello {{ n{ame }}, how are you?", {name: "bob"}],
			["invalid marker 3", "Hello {{ n{{ame }}, how are you?", {name: "bob"}],
			["invalid marker 4", "Hello {{{{ name }}, how are you?", {name: "bob"}],
			["invalid marker 5", "Hello { { name }}, how are you?", {name: "bob"}, "Hello { { name }}, how are you?"],
			["double end marker 1", "Hello {{ n}}ame }}, how are you?", {name: "bob"}],
			["double end marker 2", "Hello {{ name }}}}, how are you?", {name: "bob"}, "Hello bob}}, how are you?"],
			["invalid end marker", "Hello {{ name } }, how are you?", {name: "bob"}],
			["no extra characters check", "{{name}}", {name: "bob"}, "bob"],
			["has a newline", "Hello {{ \nname\n }}", {name: "bob"}, "Hello bob"],
			// expression syntax
			["simple expression", "{{name}}", {name: "bob"}, "bob"],
			["quoted expression", "{{\"name\"}}", {name: "bob"}, "bob"],
			["quoted expression with space", "{{\"name name\"}}", {"name name": "bob"}, "bob"],
			["simple expression with escaped quotes", "{{\\\"name\\\"}}", {"\"name\"": "bob"}, "bob"],
			["simple dot syntax expression", "{{user.name}}", {user: {name: "bob"}}, "bob"],
			["quoted dot syntax expression", "{{\"user.name\"}}", {user: {name: "bob"}}, "bob"],
			["quoted dot syntax expression with space", "{{\"user. name\"}}", {user: {" name": "bob"}}, "bob"],
			["simple expression with escaped dot", "{{user\\..name}}", {"user.": {name: "bob"}}, "bob"],
			["quoted expression with escaped dot", "{{\"user\\.. name\"}}", {"user.": {" name": "bob"}}, "bob"],
			["quoted expression with space and escaped dot", "{{\"user \\. . name\"}}", {"user . ": {" name": "bob"}}, "bob"],
			["invalid simple expression with space", "{{user name}}"],
			["invalid simple expression with un-escaped quote 1", "{{name\"}}"],
			["invalid simple expression with un-escaped quote 2", "{{\"name}}"],
			["invalid simple expression with space and un-escaped quote 1", "{{user name\"}}"],
			["invalid simple expression with space and un-escaped quote 2", "{{\"user name}}"],
			["invalid quoted expression 1", "{{\"name\\\"}}"],
			["invalid quoted expression 2", "{{\\\"name\"}}"],
			["invalid quoted expression with space 1", "{{\"user name\\\"}}"],
			["invalid quoted expression with space 2", "{{\\\"user name\"}}"],
			["invalid simple expression with space and escaped quote", "{{\\\"user name\\\"}}"],
			["invalid simple dot syntax expression 1", "{{user. name}}"],
			["invalid simple dot syntax expression 1", "{{\"user. name}}"],
			["invalid simple dot syntax expression 1", "{{user. name\"}}"],
			["invalid simple dot syntax expression 1", "{{user..name}}"],
			// data map tests
			["success - found variable", "{{a}}", {a: "b"}, "b"],
			["failed - find non-existent variable", "{{b}}", {a: "b"}]
		];

		for (var i = 0; i < templates.length; i++)
		{
			(function (i)
			{

				it(templates[i][0], function (done)
				{
					var
						tpl    = templates[i][1],
						data   = templates[i][2],
						expect = templates[i][3];

					var harvest = new stream.Readable(),
						distill = distillery({"data": data}),
						cask    = new StringAbleStream();

					var tap = harvest
						.pipe(distill)
						.on("error", function (error)
						{
							cask.emit("error", error);
						})
						.pipe(cask);

					//done(harvest, distill, tap);

					if (expect === undefined)
					{
						tap.on("error", function (error)
						{
							assert.ok(error);
							done();
						});

						tap.on("finish", function ()
						{
							assert.ok(false, "distillation should fail");
							done();
						});
					}
					else
					{
						tap.on("finish", function ()
						{
							assert.equal(tap.toString(), expect);
							done();
						});

						tap.on("error", function (error)
						{
							console.log(error);
							assert.ok(false, "distillation not should fail");
							done();
						});
					}

					harvest.push(tpl);
					harvest.push(null);
				});

			})(i);
		}
	});
});

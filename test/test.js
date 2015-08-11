var assert     = require("assert"),
	stream     = require("stream"),
	util       = require("util"),
	distillery = require("..\/"),
	fs         = require("fs");

// Verifiable Output Container
function StringableStream (options)
{
	stream.Writable.call(this, options);
	this.buffer = [];
}
util.inherits(StringableStream, stream.Writable);

StringableStream.prototype._write = function (data, encoding, done)
{
	this.buffer.push(data);
	done();
};

StringableStream.prototype.toString = function ()
{
	return Buffer.concat(this.buffer).toString();
};

function runDistillery (tpl, data, done)
{
	var harvest = new stream.Readable(),
		distill = distillery({"data": data}),
		enclose = new StringableStream();

	var transform = harvest
		.pipe(distill)
		.pipe(enclose);

	done(distill, transform);

	harvest.push(tpl);
	harvest.push(null);
}

describe("Distillery", function ()
{
	describe("condenser-tests", function ()
	{
		it("simple variable 1", function (done)
		{
			var tpl  = "Hello {{ name }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.equal(transform.toString(), "Hello " + data.name + ", how are you?");
					done();
				});
			});
		});

		it("simple variable 2", function (done)
		{
			var tpl  = "Hello {{ name}}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.equal(transform.toString(), "Hello " + data.name + ", how are you?");
					done();
				});
			});
		});

		it("simple variable 3", function (done)
		{
			var tpl  = "Hello {{name }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.equal(transform.toString(), "Hello " + data.name + ", how are you?");
					done();
				});
			});
		});

		it("simple variable 4", function (done)
		{
			var tpl  = "Hello {{name}}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.equal(transform.toString(), "Hello " + data.name + ", how are you?");
					done();
				});
			});
		});

		it("escape sequence 1", function (done)
		{
			var tpl  = "Hello {\\{ name }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function()
				{
					assert.equal(transform.toString(), "Hello {{ name }}, how are you?");
					done();
				});
			});
		});

		it("escape sequence 2", function (done)
		{
			var tpl  = "Hello \\ {\\{ name }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function()
				{
					assert.equal(transform.toString(), "Hello \\ {{ name }}, how are you?");
					done();
				});
			});
		});

		it("escape sequence 3", function (done)
		{
			var tpl  = "Hello \\ {\\\\{ name }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function()
				{
					assert.equal(transform.toString(), "Hello \\ {\\{ name }}, how are you?");
					done();
				});
			});
		});

		it("escape sequence 4", function (done)
		{
			var tpl  = "Hello \\ {\\\\\\{ name }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function()
				{
					assert.equal(transform.toString(), "Hello \\ {\\\\{ name }}, how are you?");
					done();
				});
			});
		});

		it("escape sequence 5", function (done)
		{
			var tpl  = "Hello \\{{ name }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function()
				{
					assert.equal(transform.toString(), "Hello {{ name }}, how are you?");
					done();
				});
			});
		});

		it("invalid marker 1", function (done)
		{
			var tpl  = "Hello {{ n}ame }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.ok(false, "Distillation should not finish successfully.");
					done();
				});

				distill.on("error", function (error)
				{
					assert.ok(error);
					done();
				});
			});
		});

		it("invalid marker 2", function (done)
		{
			var tpl  = "Hello {{ n{ame }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.ok(false, "Distillation should not finish successfully.");
					done();
				});

				distill.on("error", function (error)
				{
					assert.ok(error);
					done();
				});
			});
		});

		it("invalid marker 3", function (done)
		{
			var tpl  = "Hello {{ n{{ame }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.ok(false, "Distillation should not finish successfully.");
					done();
				});

				distill.on("error", function (error)
				{
					assert.ok(error);
					done();
				});
			});
		});

		it("invalid marker 4", function (done)
		{
			var tpl  = "Hello {{{{ name }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.ok(false, "Distillation should not finish successfully.");
					done();
				});

				distill.on("error", function (error)
				{
					assert.ok(error);
					done();
				});
			});
		});

		it("invalid marker 5", function (done)
		{
			var tpl  = "Hello { { name }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.equal(transform.toString(), "Hello { { name }}, how are you?");
					done();
				});
			});
		});

		it("double end marker 1", function (done)
		{
			var tpl  = "Hello {{ n}}ame }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.equal(transform.toString(), "Hello {{n}}ame }}, how are you?");
					done();
				});
			});
		});

		it("double end marker 2", function (done)
		{
			var tpl  = "Hello {{ name }}}}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.equal(transform.toString(), "Hello " + data.name + "}}, how are you?");
					done();
				});
			});
		});

		it("invalid end marker", function (done)
		{
			var tpl  = "Hello {{ name } }, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.ok(false, "Distillation should not finish successfully.");
					done();
				});
				distill.on("error", function (error)
				{
					assert.ok(error);
					done();
				});
			});
		});

		it("no extra characters check", function (done)
		{
			var tpl  = "{{name}}",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.equal(transform.toString(), data.name);
					done();
				});
			});
		});

		it("variable not found", function (done)
		{
			var tpl  = "Hello {{ name2 }}, how are you?",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.equal(transform.toString(), "Hello {{name2}}, how are you?");
					done();
				});
			});
		});

		it("has a newline", function (done)
		{
			var tpl  = "Hello {{ \nname\n }}",
				data = {
					"name": "bob"
				};
			runDistillery(tpl, data, function (distill, transform)
			{
				transform.on("finish", function ()
				{
					assert.equal(transform.toString(), "Hello " + data.name);
					done();
				});
			});
		});
	});
});

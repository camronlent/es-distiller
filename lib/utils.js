"use strict";

module.exports = {
	"isWhiteSpace": isWhiteSpace,
	"tokenSearch": tokenSearch
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
 * @param ctx The context to store the back references into.
 * @param cur The current character
 * @param key The key to store back-references under
 * @param token The token we're looking for twice
 * @param escape The character to escape the token
 * @param cbActivate The callback if the token was found twice
 * @param cbAction The callback to handle the given character until token found
 */
function tokenSearch(ctx, key, cur, token, escape, cbActivate, cbAction)
{
	// TODO: Re-evaluate this function for efficiency after factoring out un-escaping

	if (!(key in ctx.queue))
	{
		ctx.queue[key] = [];
	}

	if (cur === token || cur === escape)
	{
		ctx.queue[key].push(cur);
	}

	if (ctx.queue[key].length == 2)
	{
		switch (ctx.queue[key].join(""))
		{
			case token + token:
				cbActivate(ctx);
				ctx.queue[key].splice(0, 2);
				break;
			case token + escape:
			case escape + escape:
			case escape + token:
				cbAction(ctx, ctx.queue[key].shift());
				cbAction(ctx, ctx.queue[key].shift());
				break;
		}
	}
	else if (cur !== token && cur !== escape)
	{
		if (ctx.queue[key].length === 1)
		{
			cbAction(ctx, ctx.queue[key].shift());
		}
		cbAction(ctx, cur);
	}
}
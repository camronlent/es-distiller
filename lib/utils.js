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
 * @param cur The current character
 * @param key The key to store back-references under
 * @param token The token we're looking for twice
 * @param escape The character to escape the token
 * @param cbActivate The callback if the token was found twice
 * @param cbAction The callback to handle the given character until token found
 */
function tokenSearch(key, cur, token, escape, cbActivate, cbAction)
{
	// TODO: Re-evaluate this function for efficiency after factoring out un-escaping

	if (!(key in this.queue))
	{
		this.queue[key] = [];
	}

	if (cur === token || cur === escape)
	{
		this.queue[key].push(cur);
	}

	if (this.queue[key].length == 2)
	{
		switch (this.queue[key].join(""))
		{
			case token + token:
				cbActivate.call(this);
				this.queue[key].splice(0, 2);
				break;
			case token + escape:
			case escape + escape:
			case escape + token:
				cbAction.call(this, this.queue[key].shift());
				cbAction.call(this, this.queue[key].shift());
				break;
		}
	}
	else if (cur !== token && cur !== escape)
	{
		if (this.queue[key].length === 1)
		{
			cbAction.call(this, this.queue[key].shift());
		}
		cbAction.call(this, cur);
	}
}
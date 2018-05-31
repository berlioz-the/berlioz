const wrap = require('wordwrap')(80);
const StringBuilder = require("string-builder");
const _ = require('the-lodash');

class HelpProcessor
{
    constructor()
    {
        this._textOnly = false;
    }

    setTextOnly(value) {
        this._textOnly = value;
    }

    process(input)
    {
        this._sb = new StringBuilder();
        this._blocks = [];
        this._produceBlocks(input);
        for(var block of this._blocks)
        {
            if (block.isCode)
            {
                this._sb.appendLine();
                if (!this._textOnly) {
                    this._sb.appendLine('```');
                }
                this._sb.appendLine(block.text);
                if (!this._textOnly) {
                    this._sb.appendLine('```');
                }
            }
            else
            {
                var paragraphs = block.text.split('\n\n');
                for(var text of paragraphs)
                {
                    text = this._trimEmpty(text);
                    if (text.length > 0) {
                        text = this._replaceDoubleNewLines(text);
                        text = this._mergeParagraphs(text);
                        if (this._textOnly) {
                            text = this._wrapText(text);
                        }
                        text = this._processCommandLinks(text);

                        this._sb.appendLine();
                        this._sb.appendLine(text);
                    }
                }
            }
        }
        return this._sb.toString();
    }

    _trimEmpty(input)
    {
        return _.trim(input, '\r\n');
    }

    _produceBlocks(input)
    {
        var regex = /```/g;
        var result;
        var prevIndex = 0;
        var isInsideCode = false;

        var addBlock = (index) => {
            index = Math.min(index, input.length);
            var text = input.substring(prevIndex, index);
            text = this._trimEmpty(text);
            prevIndex = index;
            this._blocks.push({
                text: text,
                isCode: isInsideCode
            })
        }

        while(result = regex.exec(input))
        {
            var blockStartIndex = regex.lastIndex - 3;
            var blockEndIndex = regex.lastIndex;

            if (isInsideCode) {
                addBlock(blockStartIndex);
                prevIndex += 3
            } else {
                addBlock(blockStartIndex);
                prevIndex += 3
            }
            isInsideCode = !isInsideCode;
        }
        addBlock(input.length);

        // console.log(JSON.stringify(this._blocks, null, 4));
    }

    _replaceDoubleNewLines(input)
    {
        var regex = /\n\n/g;
        while(true) {
            var newinput = input.replace(regex, '\n');
            if (newinput.length == input.length) {
                return newinput;
            }
            input = newinput;
        }
        return input;
    }

    _mergeParagraphs(input)
    {
        var regex = /(\S)\n(\S)/g;
        input = input.replace(regex, (m0, m1, m2) => {
            return m1 + ' ' + m2;
        });
        return input;
    }

    _wrapText(input)
    {
        input = wrap(input);
        return input;
    }

    _processCommandLinks(input)
    {
        var regex = /\${command:([\w|\s]+)}/g;
        if (this._textOnly) {
            input = input.replace(regex, '\"$1\"');
        } else {
            input = input.replace(regex, (m0, m1) => {
                return '[' + m1 + '](#' + m1.split(' ').join('-') + ')';
            });
        }
        return input;
    }
}

module.exports = HelpProcessor;

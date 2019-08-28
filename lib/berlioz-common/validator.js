const _ = require('the-lodash');
const Errors = require('./errors');

class Validator
{
    constructor(logger)
    {
        this._logger = logger;
        require('./logger').logger = logger;
        this._errors = [];
    }

    submitItemJoiError(item, joiError)
    {
        for(var error of joiError.details)
        {
            var message = `${error.message}, path: ${error.path}, context: ${JSON.stringify(error.context)}`;

            this._logger.warn('Validation error with %s. File: %s. Error: %s', 
                item.id, 
                item.berliozfile,
                message);

            this.submitItemError(item, message);
        }
    }

    submitItemError(item, message)
    {
        this._logger.warn('Error with %s at %s. Error: %s', 
            item.id,
            item.berliozfile, 
            message);
            
        this._submitRawError(item.berliozfile, item.id, message);
    }

    submitPathError(path, message)
    {
        this._logger.warn('Error with file: %s. Error: %s', 
            path, 
            message);

        this._submitRawError(path, path, message);
    }

    _submitRawError(path, target, message)
    {
        this._errors.push({
            filePath: path,
            target: target,
            message: message
        });
    }

    enforce()
    {
        if (this._errors.length > 0) {
            throw new Errors.Entity('There were errors in Berliozfile(s).', this);
        }
    }

    outputScreen(screen)
    {
        var tableData = [];
        var i = 0;
        for(var error of this._errors)
        {
            i++;
            var filePath = "";
            if (error.filePath) {
                filePath = error.filePath;
            }
            tableData.push([this._padNumber(i, 3), filePath, error.message])
        }

        screen.table()
            .column('#', 3, true)
            .column('Location')
            .column('Error')
        .addRange(tableData)
        .output();
    }

    _padNumber(num, size) 
    {
        var s = String(num);
        while (s.length < (size || 2)) {s = "0" + s;}
        return s;
    }
}

module.exports = Validator;

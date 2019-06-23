
const CommonErrors = require('../berlioz-common/errors');

class AuthError extends Error
{
    constructor(message)
    {
        super(message);
    }
};

class InputError extends Error
{
    constructor(message)
    {
        super(message);
    }
};

class MissingPrerequisiteError extends Error
{
    constructor(message)
    {
        super(message);
    }
};

module.exports = {
    Auth: AuthError,
    Input: InputError,
    MissingPrerequisite: MissingPrerequisiteError,
    Generic: CommonErrors.Generic
}

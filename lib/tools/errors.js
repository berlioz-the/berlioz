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

class GenericError extends Error
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
    Generic: GenericError
    
}

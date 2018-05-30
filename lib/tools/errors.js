class AuthError extends Error
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
    MissingPrerequisite: MissingPrerequisiteError

}

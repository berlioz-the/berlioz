class AuthError extends Error
{
    constructor(message)
    {
        super(message);
    }
};

module.exports = {

    Auth: AuthError

}

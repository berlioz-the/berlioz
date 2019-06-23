class EntityError extends Error
{
    constructor(message, validator)
    {
        super(message);
        this._validator = validator;
    }

    get validator() {
        return this._validator;
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
    Entity: EntityError,
    Generic: GenericError
}

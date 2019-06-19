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

module.exports = {
    Entity: EntityError
}

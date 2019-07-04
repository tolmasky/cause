const { data } = require("@algebraic/type");
const ESTreeNameRegExp = /^[^{]*{ESTree\s*\=\s*([^}]+)}$/;


// ESTree looks for the "type" property of nodes to identify them. We will be
// extending the types available in ESTree and thus allow one to provide the
// "translation type" if available. We use this for IdentifierPattern and
// IdentifierExpression as they both appear as "Identifier" to ESTree/Babel.
module.exports = function ESTreeBridge ([name])
{
    return function (...fields)
    {
        const ESTreeType = (name.match(ESTreeNameRegExp) || [, name])[1];
        const type = data ([name]) (...fields);

        type.prototype.type = ESTreeType;

        return type;
    }
}

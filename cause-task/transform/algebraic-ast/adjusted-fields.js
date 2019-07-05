const { string } = require("@algebraic/type");
const { Set } = require("@algebraic/collections");
const { fromJS } = require("immutable");
const nullable = (...oneOfNodeTypes) => ({ oneOfNodeTypes, optional: true }); 
const types = (...oneOfNodeTypes) => ({ oneOfNodeTypes });
const direct = type => ({ validate: { direct: type } });


module.exports = fromJS(require("@babel/types").NODE_FIELDS)

    // ObjectProperty's value is Expression | PatternLike to allow it to do
    // double-duty as a member of an ObjectExpression and ObjectPattern.
    // However, since we have a separate ObjectPatternProperty, we don't need
    // PatternLike anymore.
    .setIn(["ObjectProperty", "value", "validate"], types("Expression"))

    // CatchClause's is a binding.
    .setIn(["CatchClause", "param", "validate"], nullable("IdentifierPattern"))

    // This needs to be nullable because it can be null in export default
    // function () { } case.
    .setIn(["FunctionDeclaration", "id", "validate"], nullable("IdentifierPattern"))

    .setIn(["FunctionExpression", "id", "validate"], nullable("IdentifierPattern"))

    .setIn(["AssignmentPattern", "left", "validate"], types("RootPattern"))
    .setIn(["AssignmentPattern", "bindings"], direct(Set(string)))

    .setIn(["ArrayPattern", "bindings"], direct(Set(string)))
    .setIn(["RestElement", "bindings"], direct(Set(string)))
    .setIn(["ObjectPattern", "bindings"], direct(Set(string)))


    // We currently don't parameterize Arrays, so don't do anything to this yet.
    //.setIn(["ArrayPattern", "elements", "validate"],
    //    types("IdentifierPattern", "ObjectPattern", "ArrayPattern"))

    .setIn(["ClassDeclaration", "id", "validate"], types("IdentifierPattern"))
    .setIn(["ClassExpression", "id", "validate"], types("IdentifierPattern"))
    .setIn(["ClassImplements", "id", "validate"], types("IdentifierPattern"))

    // [a <- reference] as [b <- useless in our scope]
    .setIn(["ExportSpecifier", "local", "validate"], types("IdentifierExpression"))
    .setIn(["ExportDefaultSpecifier", "exported", "validate"], types("IdentifierExpression"))
    .setIn(["ImportDefaultSpecifier", "local", "validate"], types("IdentifierPattern"))
    
    .setIn(["PrivateName", "id"], types("IdentifierPattern"))
    // ExportNamespaceSpecifier
    // ImportNamespaceSpecifier ?
    // ImportSpecifier ?

    .toJS();

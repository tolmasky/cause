const { data, union, parameterized, primitives } = require("@algebraic/type");
const { Optional, None } = require("@algebraic/type/optional");
const fail = require("@algebraic/type/fail");

const t = require("@babel/types");
const fromDefinition = ({ optional, validate }) =>
   (type => optional ?
        [Optional(type), None] :
        type)(fromValidate(validate) || Object);
const fromValidate = validate =>
    !validate ? Object :
    validate.type && validate.type !== "array" ?
        primitives[validate.type] :
    validate.chainOf ?
        validate.chainOf.map(fromValidate).find(x => !!x) :
    false;
const toField = (name, type) =>
    (new Function(`return ${name === "extends" || name === "default" || name === "const" ? "_extends" : name } => arguments[0]`))(type);

const concrete = Object.fromEntries(t
    .TYPES
    .filter(name => t[name] && !t.DEPRECATED_KEYS[name])
    .map(name => [name, data ([name]) (...Object
        .entries(t.NODE_FIELDS[name])
        .map(([name, definition]) => [name, fromDefinition(definition)])
        .map(([name, type]) => toField(name, type)))]));



console.log(concrete.RestElement({ argument: concrete.Identifier({ name:"hi" }) }));


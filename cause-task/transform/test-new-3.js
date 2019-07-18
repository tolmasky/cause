const generate = node => require("@babel/generator").default(node).code
const parse = require("@algebraic/ast/parse").expression;

//const node = require("./map-conc")(parse( WRAP+""));
const node = require("./map-conc")(parse((() => parallel(() =>
{
    const a = wrt[b]();
    const c = wrt[d]() + 7 + wrt[e]();

    return a;
}))+ ""));

console.log(node);

console.log(generate(node));


/*
const Scope = require("./scope");
const mapScope = require("./map-scope");
const disambiguateIdentifiers = require("./disambiguate-identifiers");
const mapConcurrent = require("./map-concurrent");

// Another example of derivatives? I can only opreatee of disambiguated...
const disambiguated = disambiguateIdentifiers.function(testConcurrent2);
const scoped = mapScope(disambiguated);
const concurrent = mapConcurrent(scoped);

mapConcurrent.getConvertedType(concurrent).dependencies.map(dependency => console.log(dependency.keyPath + ""));
console.log(Scope.for(concurrent));
console.log(require("@babel/generator").default(concurrent).code);
*/

// Scope boundary


function testConcurrent()
{
    const result1 = wrt[a]() + wrt[b]();
    const result2 = f(result1) + wrt[c](result1);
    const result3 = [1,2,3].map(wrt[d]).reduce(f, result2);
    const result4 = wrt[c](wrt[a]());
    
    if (wrt[d](result4))
        return wrt[p]();

    if (wrt[d](result4) + 1)
        throw wrt[p]();

    if (wrt[e](result4) + 2)
    {
        const result7 = wrt[u]();

        return result7 + wrt[y]();
    }

    return result3;
}

function WRAP(){
return parallel(
function testConcurrent2()
{
    const   result1 = wrt[a]() + wrt[b](),
            result2 = wrt[f](result1);
    const result3 = a_function();;;;
    const result4 = result3 || wrt[d]();
    const result5 = result4 ? wrt[e]() : g();
    const y = 5 + m;
    const z = 1 - y;
    const a = () => b;
    const b = () => a;

;
;
;
;
/*
    if (wrt[d](result4))
        return wrt[p]();

    if (wrt[d](result4) + 1)
        throw wrt[p]();

    if (wrt[e](result4) + 2)
    {
        const result7 = wrt[u]();

        return result7 + wrt[y]();
    }
*/
    return if_ (result5, () => stuff, () => other_stuff);;
    
    function a_function()
    {
        return result2;
    }
}) };


function bFunctionName(bFunctionParameter)
{
    const b1 = f1;
    const [b2, ...b3] = [f2, ...f3];

    {
        const [hidden1, ...hidden2] = f4;
    }
    
    {
        const [hidden3, ...hidden4] = f5;

        {
            const [hidden5, ...hidden6] = f6;
        }
    }

    if (f7 > b2)
    {
        const [hidden7, ...hidden8] = f8;

        return hidden7 + hidden8 + f9 + f8;
    }
    
    const { b4, hidden9: b5, hidden10:
        { b6, hidden11: [b7, ...b8], ...b9 } } = f10;
    
    const [b10 = f11] = f12;
}
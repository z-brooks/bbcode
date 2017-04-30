import test from 'ava';
import {TagDefinition,AttributeDefinition} from '../src/def';
import {TagNode, TagAttribute} from '../src/tag-parser';

function tag( n, c = [], a = null, f = null )
{
    return new TagNode( new TagDefinition( n, c, a, f ) );
}

function attr( n, f )
{
    return new TagAttribute( 'foo', new AttributeDefinition( n, f ) );
}

test( 'fails when given invalid definition', t => {
    try
    {
        new TagNode();
    }
    catch( e )
    {
        t.pass();
    }
} );

test( 'allow valid children', t => {
    let a = tag( 'a', ['b'] );
    let b = tag( 'b' );

    t.true( a.add_child( b ) );
} );

test( 'does not allow invalid children', t => {
    let a = tag( 'a' );
    let b = tag( 'b' );

    t.not( a.add_child( b ), true );
} );

test( 'allow valid attributes', t => {
    let a = attr( 'a' );

    let b = tag( 'b', null, [a.def] );

    t.true( b.add_attribute( a ) );
} );

test( `don't allow invalid attributes`, t => {
    let a = attr( 'a' );
    let b = tag( 'b', null, [] );

    t.false( b.add_attribute( a ) );
} );

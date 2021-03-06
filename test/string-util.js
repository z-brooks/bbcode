import {test} from 'ava';
import {IdentifierValidator} from '../src/validator';
import {string_iter} from '../src/string-iter';
import {substring,
        substring_quoted,
        scan_to,
        scan_while,
        substring_validator} from '../src/string-util';

test( 'substring', t => {
    let it1 = new string_iter( 'abcdef', 1 );
    let it2 = it1.clone();
    it2.index = 4;

    let str = substring( it1, it2 );
    
    t.is( str, 'bcd' );
} );

test( 'substring_quoted', t => {
    let itr = new string_iter( '"foo"' );
    let str = substring_quoted( itr );

    t.is( str, 'foo' );
} );

test( 'substring_quoted with invalid', t => {
    let itr = new string_iter( ':foo bar:');
    let str = substring_quoted( itr, ' ' );

    t.is( str, '' );
} );

test( 'scan_to', t => {

    [
        '=',
        ['='],
        v => v == '='
    ]
     .forEach( _t => {
        let itr = new string_iter( 'abc=def' );
        scan_to( itr, _t );
        t.is( itr.value, '=' );
    });
} );

test( 'scan_while', t => {

    [
        '.',
        ['.'],
        v => v == '.'
    ]
     .forEach( _t => {
        let itr = new string_iter( '....bc' );
        scan_while( itr, _t );
        t.is( itr.value, 'b' );
    });
} );

test( 'substring_validator', t => {
    let v = new IdentifierValidator();

    let str = 'ab0-9YZ';
    let ident = substring_validator( new string_iter( str ), v );
    t.is( ident, str );

    let str2 = '-a';
    t.is( substring_validator( new string_iter( str2 ), v ), '' );  // expect invalid identifier
} );
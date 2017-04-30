import {is_func, is_map, is_set, is_array} from './helper';

export class stack
{
    _items = [];
    constructor( ...init )
    {
        this.push_many( init );
    }

    get size() { return this.length; }
    get length() { return this._items.length; }

    values() { return this._items; }
    entries() { return this._items; }

    clear()
    {
        this._items = [];
    }

    // push collections
    push_many( c )
    {
        if ( !c ) { return; }

        if ( is_map( c ) ) // Maps
        {
            for( let [, v] of c ) { this.push( v ); }
        }
        else if ( is_func( c ) ) // generator
        {
            for( let v of c() ) { this.push( v ); }
        }
        else // other iterables
        {
            for( let v of c ) { this.push( v ); }
        }
    }

    push( v )
    {
        v !== undefined && this._items.push( v );
    }

    pop()
    {
        return this._items.pop();
    }

    forEach( cb )
    {
        for( let i = this.length - 1; i >= 0; --i )
        {
            cb( this._items[i], i, this );
        }
    }

    pop_each( cb )
    {
        while( this.size )
        {
            cb( this.pop(), this );
        }
    }

    peek( index )
    {
        return this._items[index];
    }

    back()
    {
        if ( this.length )
        {
            return this._items[this.length - 1];
        }
        return null;
    }
    
    front()
    {
        if ( this.length )
        {
            return this._items[0];
        }
        return null;
    }
    
    find( val, compare = (a, b) => a === b )
    {
        let v;
        for( let i = this.length - 1; i >= 0; --i )
        {
            v = this._items[i];
            if ( compare( val, v ) ) { return v; }
        }
        return null;
    }

    any_of( pred )
    {
        for( let i = this.length - 1; i >= 0; --i )
        {
            if ( pred( this._items[i] ) ) { return true; }
        }
        return false;
    }

    all_of( pred )
    {
        for( let i = this.length - 1; i >= 0; --i )
        {
            if ( !pred( this._items[i] ) ) { return false; }
        }

        return true;
    }

    [Symbol.iterator]()
    {
        let i = this._items.length;
        return {
            next: () => { return { value: this._items[--i], done: (i < 0) }; }
        };
    }
}

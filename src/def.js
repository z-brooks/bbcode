import {TagParser, TagAttribute} from './tag-parser';
import {stack} from './stack';
import {Node, TextNode} from './nodes';
import {is_array, is_func, ensure_array} from './helper';

export class AttrPair
{
    constructor( identifier, value )
    {
        this.identifier = identifier;
        this.value = value;
    }
}

export class BaseFormatter
{
    constructor( format_type, props )
    {
        Object.assign( this, props );
        this.format_type = format_type;
    }

    format() { return null; }
}

/**
 * Attribute Formatter
 */
export class AttributeFormatter extends BaseFormatter
{   
    constructor( identifier, format_type, props = {} )
    {
        super( format_type, props );
        this.identifier = identifier;
    }

    format( value )
    {
        return new AttrPair(this.identifier, this.sanitize(value));
    }

    sanitize( value )
    {
        return AttributeFormatter.escape( value );
    }

    static escape( value )
    {
        if ( typeof value === 'string' ) { return JSON.stringify( value ).slice(1, -1); }
        return value;
    }
}

/**
 * ATTRIBUTE DEFINITIONS
 */
export class AttributeDefinition
{
    static require_value_default = true;

    identifier;

    required = false;   // lets parser know that this attribute is required. the parser will attempt to create it when missing.

    require_value = AttributeDefinition.require_value_default;  // lets the parser know a value is required to be a valid attribute
    default_value = null;                                       // default value to set if required_value and value is null/undefined

    constructor( identifier, formatter = null, props = {} )
    {
        Object.assign( this, props );

        this.identifier = identifier;

        this.formatters = new Map();
        if ( formatter )
        {
            if ( !is_array( formatter ) )
            { 
                this.add_formatter( formatter ); 
            }
            else
            {
                for( let f of formatter )
                {
                    this.add_formatter( f );
                }
            }
        }
    }

    // checks if a value is set when required.
    valid_value( v )
    {
        return !this.require_value || (this.require_value && !!v);
    }    

    // used when a tag-attribute value is set. 
    validate( value ) { return !this.valid_value(value) ? this.default_value : value; }

    add_formatter( fmt, replace = false )
    {
        if ( fmt instanceof AttributeFormatter )
        {
            if ( replace || !this.formatters.has( fmt.format_type.name ) )
            {
                this.formatters.set( fmt.format_type.name, fmt );
            }
        }
    }

    /**
     * Transform to output format
     * @param {*} format target format
     * @param {*} value value of the attribute as parsed
     * @param {*} attr the attribute node
     */
    format( format, value, attr )
    {
        if ( this.formatters.has( format ) )
        {
            let ret = this.formatters.get( format ).format( value, attr );
            if ( !(ret instanceof Node) )   // attributes may transform to a node 
            {
                if ( !this.valid_value( ret.value ) ) 
                {
                    if ( this.default_value ) { ret.value = this.default_value; }
                    else { return null; }
                }
            }

            return ret; 
        }

        return null;    // return null and the attribute is ignored
    }
}

/**
 * Color Attribute (#...)
 */
export class ColorAttrDefinition extends AttributeDefinition
{
    constructor( identifier, formats, props )
    {
        super( identifier, formats, props );
    }

    valid_char( chr, start )
    {
        return (( start && chr === '#' ) || TagParser.valid_value_char( chr ));
    }
}

/**
 * URL Attribute
 */
export class UrlAttrDefinition extends AttributeDefinition
{
    static valid = './:%_-&*$?';
    constructor( identifier, formats, props )
    {
        super( identifier, formats, props );
    }

    valid_char( ch )
    {
        return TagParser.valid_value_char( ch ) || UrlAttrDefinition.valid.includes( ch );
    }
}

/**
 * Number Attribute
 */
export class NumberAttrDefinition extends AttributeDefinition
{
    constructor( identifier, min, max, formats, props )
    {
        super( identifier, formats, props );
        this.min = min;
        this.max = max;
    }

    valid_char( c )
    {
        return ( c >= '0' && c <= '9' );
    }

    validate( value )
    {
        let v = +super.validate( value );
        if ( (!!v && v !== 0) && (v >= this.min && v <= this.max) ) { return v; }
        
        return this.min; 
    }
}

/**
 * Attribute with a set list of valid values
 */
export class ListAttrDefinition extends AttributeDefinition
{
    constructor( identifier, valid_values, formats, props )
    {
        super(identifier, formats, props );

        this.valid_values = ensure_array( valid_values ); // list of valid values.   
    }

    validate( value )
    {
        if ( this.valid_values.includes(value) ) { return value; }

        return this.valid_values[this.default_index || 0];
    }
}

/**
 * TAG FORMATTING
 */
export class TagFormatter extends BaseFormatter
{
    constructor( identifier, format_type, props )
    {
        super( format_type, props );
        this.identifier = identifier;
    }

    /**
     * @param {*} children an array of children to format
     */
    format_children( children )
    {
        if ( !children || !children.length ) { return ''; }

        let str = [];
        for( let child of children )
        {
            if ( child.format )
            {
                str.push( child.format( this.format_type.name ) );
            }
            else if ( typeof child === 'string' )
            {
                str.push( this.format_type.sanitize( child ) );
            }
        }
        return str.join( '' );
    }

    format( def, children, attributes )
    {
        return this.format_children( children );
    }
}

export class MarkupTagFormatter extends TagFormatter
{
    constructor( identifier, format_type, attributes, props )
    {
        super( identifier, format_type, props );
        this.attributes = ensure_array( attributes );
    }

    format_attribute( attribute, map, children )
    {
        // expect attribute === AttrPair / TagAttribute
        let a_v;
        if ( attribute instanceof TagAttribute ) { a_v = ensure_array(attribute.format( this.format_type.name )); }
        else { a_v = [attribute]; } // assume object {identifier/value} or AttrPair

        let attribs = [];
        for( let attr of a_v )
        {
            if ( attr instanceof Node || typeof attr === 'string' )    // attribute became a child.
            {
                children.push( attr );
            }
            else if ( attr instanceof TagAttribute )    // allow 1 attribute to become many (one-to-many)
            {
                attribs.push( attr );
            }
            else if ( attr && attr.identifier )
            {
                if ( map.has( attr.identifier ) ) // some parsed attributes might map to the same converted attribute (style,class...). (many-to-one)
                {
                    let v = map.get( attr.identifier );
                    v.value.push( attr.value );
                }
                else 
                {
                    map.set( attr.identifier, { 
                        quote: this.format_type.quote === null ? attribute.quote || '' : this.format_type.quote, //!!quote ? quote : attr.quote, 
                        value: [attr.value]
                    });
                }
            }
        }

        return attribs;
    }

    format_attributes( attributes )
    {
        if ( !attributes ) { return ['', null]; }

        let attr_map = new Map();
        let children = [];

        let attr_stack = new stack();

        attr_stack.push_many(attributes);
        attr_stack.push_many(this.attributes);

        attr_stack.pop_each( attrib => attr_stack.push_many( this.format_attribute( attrib, attr_map, children) ) );

        // combine attribute identifiers & values
        let attribs = [];
        for( let [k, a] of attr_map )
        {
            let a_str = a.value.join( ' ' ).trim();
            if ( !a_str )
            {
                attribs.push( k );
            }
            else
            {
                attribs.push( `${k}${this.format_type.eq}${a.quote}${a_str}${a.quote}` );
            }
        }

        return [attribs.join( ' ' ), children];
    }

    format_tag( attributes, identifier, close = '' )
    {
        if ( identifier === null ) { return ['', ]; }

        let attribs = '';
        let temp_children = [];
        if ( attributes )
        {
            [attribs, temp_children] = this.format_attributes( attributes );
        }

        let mid = `${identifier} ${attribs}`.trim();

        return [`${this.format_type.l_bracket}${close}${mid}${this.format_type.r_bracket}`, temp_children];        
    }

    format_markup( def, children, attributes, identifier = this.identifier )
    {
        let [open_ident, close_ident] = is_array(identifier) ? identifier : [identifier,identifier];

        let open_tag = '';
        let close_tag = '';
        let temp_children = [];

        [open_tag, temp_children] = this.format_tag( attributes, open_ident );

        let _void = this.is_void !== undefined ? this.is_void : def.is_void;
        if ( _void )
        {
            return open_tag;
        }

        let c_str = this.format_children( temp_children );
        c_str += this.format_children( children );

        if ( is_func( def.content_parser ) )
        {
            c_str = def.content_parser( this.format_type, c_str );
        }

        [close_tag, temp_children] = this.format_tag( null, close_ident, '/' );

        return `${open_tag}${c_str}${close_tag}`;
    }

    format( def, children, attributes )
    {
        return this.format_markup( def, children, attributes, this.identifier );
    }
}

export class TagDefinition
{
    identifier;       // tag identifier
    is_void = false;    // tag is self-closing
    overflow = true;   // if parent terminates before this tag: true start again in next parent; false terminate with current parent.
    terminate;  // other tags that cause this one to terminate/close.

    type_child = null;

    children   = null;
    attributes = null;

    parents = null;       // valid parent tags.
    parents_allow = true; // true: whitelist mode

    add_missing = true; // add missing attributes during format. false: empty string

    formats; // formatters.

    /**
     * Constructor
     * @param {*} identifier identifier of the tag (in its origin format)
     * @param {*} children allowed child tags: null = all; otherwise pass an array of tag identifiers
     * @param {*} attributes allowed attributes: null = all, otherwise pass an array of attribute definitions
     * @param {*} formats format converters
     * @param {*} props { other, properties }
     */
    constructor( identifier, children = null, attributes = null, formats = null, props = {} )
    {
        if ( !identifier ) 
        {
            throw new Error('TagDefinition requires a identifier.');
        }

        Object.assign( this, props );

        this.identifier = identifier;

        if ( is_array( children ) ) { this.children = new Set( children ); }
        else if ( children instanceof Set ) { this.children = children; }

        this.attributes = new Map();
        if ( is_array( attributes ) )
        {
            for( let a of attributes )
            {
                this.attributes.set( a.identifier, a );
            }
        }
        else if ( !attributes )
        {
            this.__allow_all_attributes = true;
        }

        if ( props.terminate  ) { this.terminate  = new Set( ensure_array( props.terminate ) );  }
        if ( props.type_child ) { this.type_child = new Set( ensure_array( props.type_child ) ); }
        if ( props.parents    ) { this.parents    = new Set( ensure_array( props.parents ) );    }

        this.formats = new Map();
        if ( formats )
        {
            if ( !is_array( formats ) )
            { 
                this.add_formatter( formats ); 
            }
            else
            {
                for( let f of formats )
                {
                    this.add_formatter( f );
                }
            }
        }
    }

    /**
     * Add a 'Formatter' that will transform the node into some text output
     * @param {*} fmt formatter
     * @param {*} replace replace if another formatter of the same type exists
     */
    add_formatter( fmt, replace = false )
    {
        if ( fmt instanceof BaseFormatter )
        {
            if ( replace || !this.formats.has( fmt.format_type.name ) )
            {
                this.formats.set( fmt.format_type.name, fmt );
            }
        }
    }

    format( format, children, attributes, tag )
    {
        if ( this.formats.has( format ) )
        {
            let fmtr = this.formats.get( format );
            return fmtr.format( this, children, attributes, tag );
        }

        return '';
    }

    valid_child( node )
    {
        if ( this.is_void ) { return false; }
        if ( this.terminate && this.terminate.has( node.identifier ) ) { return node; }

        if ( node instanceof TextNode && node.length <= 0 ) { return false; }   // no empty text. 

        let def = node.def || node;
        if ( def instanceof TagDefinition )
        {
            return (!this.children || this.children.has( def.identifier )) && def.valid_parent( this );
        }

        if ( !this.type_child ) { return true; }

        for( let t of this.type_child )
        {
            if ( node instanceof t ) { return true; }
        }

        return false;
    }

    valid_parent( tag )
    {
        if ( !this.parents ) { return this.parents_allow; }

        let identifier;
        if ( typeof tag === 'string' ) { identifier = tag; }
        else if ( tag instanceof TagDefinition || tag.identifier ) { identifier = tag.identifier; }
        else if ( tag.def ) { identifier = tag.def.identifier; }

        return this.parents.has( identifier ) ? this.parents_allow : !this.parents_allow;
    }

    valid_attribute( attr )
    {
        if ( this.__allow_all_attributes ) { return true; }

        let identifier = '';
        if ( typeof attr === 'string' ) { identifier = attr; }
        else if ( attr instanceof AttributeDefinition || attr.identifier ) { identifier = attr.identifier; }
        else if ( attr.def ) { identifier = attr.def.identifier; }

        return this.attributes.has( identifier );
    }

    // get attribute def
    get_attribute( identifier )
    {
            // null/undefined attributes means all are allowed.
        if ( this.__allow_all_attributes && !this.attributes.has( identifier ) )
        {
                // create definitions as needed.
            let def = new AttributeDefinition( identifier );
            for( let [, f] of this.formats )
            {
                def.add_formatter( new AttributeFormatter( identifier, f.format_type ) );
            }
            this.attributes.set( identifier, def );
            return def;   
        }

        return this.attributes.get( identifier );
    }
}

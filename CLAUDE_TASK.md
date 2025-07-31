# FoundryVTT Field Types to JSON Schema Mapping Strategy

## Executive Summary

This document provides a comprehensive analysis of FoundryVTT's field type system and a strategy for converting these field definitions to JSON Schema format. The analysis is based on examination of FoundryVTT's DataField classes in `/resources/app/common/data/fields.mjs`.

## FoundryVTT Field Type System Overview

### Base DataField Class
- **Location**: `/resources/app/common/data/fields.mjs`
- **Purpose**: Abstract base class for all field types
- **Key Properties**:
  - `required`: Is this field required to be populated?
  - `nullable`: Can this field have null values?
  - `initial`: The initial value or function that assigns it
  - `label`: Localizable label for forms
  - `hint`: Localizable help text
  - `validate`: Custom validation function
  - `readonly`: Is the field read-only?
  - `gmOnly`: Can only be modified by GM?

### Core Field Types

1. **BooleanField**
   - Handles boolean data
   - Default: `required: true, nullable: false, initial: false`
   - Casts strings "true"/"false" to boolean

2. **NumberField**
   - Handles numeric data
   - Additional properties:
     - `min`: Minimum allowed value
     - `max`: Maximum allowed value
     - `step`: Permitted step size
     - `integer`: Must be an integer?
     - `positive`: Must be positive?
     - `choices`: Array/object of allowed values

3. **StringField**
   - Handles string data
   - Additional properties:
     - `blank`: Can the string be empty?
     - `trim`: Should strings be trimmed?
     - `choices`: Array/object of allowed values
     - `textSearch`: Is this field searchable?

4. **SchemaField**
   - Contains nested field definitions
   - Recursive structure for complex objects
   - Contains a `fields` property with sub-field definitions

5. **ArrayField**
   - Contains array of elements
   - Properties:
     - `element`: DataField defining the array element type
     - `min`: Minimum array length
     - `max`: Maximum array length
     - `empty`: Can the array be empty?

6. **ObjectField**
   - Handles generic object data
   - Less structured than SchemaField

7. **SetField**
   - Extends ArrayField for unique elements
   - Ensures array contains unique values

### Specialized Field Types

- **DocumentIdField**: Validates document IDs
- **FilePathField**: Validates file paths with category restrictions
- **ColorField**: Validates color strings
- **AngleField**: Numeric field for angles (0-360)
- **AlphaField**: Numeric field for alpha values (0-1)
- **HTMLField**: String field for HTML content
- **JSONField**: String field for JSON data

## JSON Schema Mapping Strategy

### Field Type Mappings

```javascript
const fieldTypeToJSONSchema = {
  'BooleanField': {
    type: 'boolean'
  },
  
  'NumberField': (field) => ({
    type: field.integer ? 'integer' : 'number',
    minimum: field.min,
    maximum: field.max,
    multipleOf: field.step,
    enum: field.choices ? (Array.isArray(field.choices) ? field.choices : Object.keys(field.choices).map(Number)) : undefined
  }),
  
  'StringField': (field) => ({
    type: 'string',
    minLength: field.blank ? 0 : 1,
    enum: field.choices ? (Array.isArray(field.choices) ? field.choices : Object.keys(field.choices)) : undefined,
    pattern: field.pattern?.toString()
  }),
  
  'SchemaField': (field) => ({
    type: 'object',
    properties: Object.entries(field.fields).reduce((props, [key, subField]) => {
      props[key] = convertFieldToJSONSchema(subField);
      return props;
    }, {}),
    required: Object.entries(field.fields)
      .filter(([key, subField]) => subField.required && !subField.nullable)
      .map(([key]) => key)
  }),
  
  'ArrayField': (field) => ({
    type: 'array',
    items: convertFieldToJSONSchema(field.element),
    minItems: field.min,
    maxItems: field.max === Infinity ? undefined : field.max
  }),
  
  'ObjectField': {
    type: 'object',
    additionalProperties: true
  },
  
  'SetField': (field) => ({
    type: 'array',
    items: convertFieldToJSONSchema(field.element),
    uniqueItems: true,
    minItems: field.min,
    maxItems: field.max === Infinity ? undefined : field.max
  })
};
```

### Common Properties Mapping

```javascript
function addCommonProperties(jsonSchema, field) {
  // Handle nullability
  if (field.nullable && !field.required) {
    jsonSchema.type = [jsonSchema.type, 'null'];
  }
  
  // Add default value
  if (field.initial !== undefined) {
    jsonSchema.default = typeof field.initial === 'function' ? field.initial({}) : field.initial;
  }
  
  // Add metadata
  if (field.label) jsonSchema.title = field.label;
  if (field.hint) jsonSchema.description = field.hint;
  if (field.readonly) jsonSchema.readOnly = true;
  
  return jsonSchema;
}
```

### Implementation Approach

1. **Direct Field Access**
   ```javascript
   function convertFieldToJSONSchema(field) {
     const fieldType = field.constructor.name;
     let schema = {};
     
     // Get base schema for field type
     const mapper = fieldTypeToJSONSchema[fieldType];
     if (typeof mapper === 'function') {
       schema = mapper(field);
     } else if (mapper) {
       schema = { ...mapper };
     } else {
       // Fallback for unknown types
       schema = { type: 'string' };
     }
     
     // Add common properties
     return addCommonProperties(schema, field);
   }
   ```

2. **Schema Extraction from DataModel**
   ```javascript
   function extractJSONSchema(dataModelClass) {
     const schema = dataModelClass.defineSchema();
     const schemaField = new SchemaField(schema);
     return convertFieldToJSONSchema(schemaField);
   }
   ```

## Challenges and Considerations

1. **Custom Validation Functions**
   - FoundryVTT allows custom validation functions
   - JSON Schema has limited custom validation support
   - May need to document custom validations separately

2. **Dynamic Initial Values**
   - FoundryVTT supports functions for initial values
   - JSON Schema only supports static defaults
   - Need to evaluate functions at conversion time

3. **Complex Field Types**
   - Some FoundryVTT fields have complex behaviors (e.g., ForeignDocumentField)
   - May need simplified representations in JSON Schema

4. **System-Specific Extensions**
   - Game systems add custom field types
   - Need flexible conversion system to handle unknowns

## Recommendations

1. **Use Runtime Extraction**
   - Load actual FoundryVTT modules to get real field instances
   - Convert live field objects rather than parsing code

2. **Maintain Fidelity**
   - Preserve as much validation information as possible
   - Document any validation rules that can't be expressed in JSON Schema

3. **Create Extensible System**
   - Allow registration of custom field type converters
   - Support system-specific field types

4. **Validate Conversions**
   - Test that JSON Schema validates same inputs as FoundryVTT
   - Ensure no valid data is rejected by conversion

## Next Steps

1. Implement the core conversion function
2. Test with actual FoundryVTT document schemas
3. Handle edge cases and custom field types
4. Create utility for batch schema extraction
5. Document any limitations or differences

## Conclusion

Converting FoundryVTT field definitions to JSON Schema is feasible with a systematic mapping approach. The key is to:
- Access actual field instances at runtime
- Map field properties to JSON Schema equivalents
- Handle special cases appropriately
- Maintain validation fidelity where possible

This strategy provides a foundation for creating a robust field type conversion system that can generate accurate JSON schemas from FoundryVTT's DataField-based validation system.
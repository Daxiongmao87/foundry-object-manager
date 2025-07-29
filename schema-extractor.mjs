#!/usr/bin/env node

/**
 * FoundryVTT Schema Extractor
 * Converts FoundryVTT DataModel field definitions to validation rules
 */

class SchemaExtractor {
    constructor(foundryEnv) {
        this.foundryEnv = foundryEnv;
        this.fieldTypeMapping = this.createFieldTypeMapping();
    }

    /**
     * Create mapping between FoundryVTT field types and validation rules
     */
    createFieldTypeMapping() {
        return {
            'BooleanField': this.extractBooleanField.bind(this),
            'NumberField': this.extractNumberField.bind(this),
            'StringField': this.extractStringField.bind(this),
            'ObjectField': this.extractObjectField.bind(this),
            'ArrayField': this.extractArrayField.bind(this),
            'SchemaField': this.extractSchemaField.bind(this),
            'EmbeddedDataField': this.extractEmbeddedDataField.bind(this),
            'EmbeddedCollectionField': this.extractEmbeddedCollectionField.bind(this),
            'TypeDataField': this.extractTypeDataField.bind(this),
            'DocumentIdField': this.extractDocumentIdField.bind(this),
            'FilePathField': this.extractFilePathField.bind(this),
            'HTMLField': this.extractHTMLField.bind(this),
            'JSONField': this.extractJSONField.bind(this),
            'ColorField': this.extractColorField.bind(this),
            'AlphaField': this.extractAlphaField.bind(this),
            'AngleField': this.extractAngleField.bind(this),
            'DocumentTypeField': this.extractDocumentTypeField.bind(this)
        };
    }

    /**
     * Extract validation rules from a FoundryVTT schema
     */
    extractSchema(schema, path = '') {
        if (!schema || typeof schema !== 'object') {
            return null;
        }

        const extractedSchema = {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
            _foundrySchema: true
        };

        for (const [fieldName, field] of Object.entries(schema)) {
            const fieldPath = path ? `${path}.${fieldName}` : fieldName;
            
            try {
                const fieldRule = this.extractFieldRule(field, fieldPath);
                if (fieldRule) {
                    extractedSchema.properties[fieldName] = fieldRule;
                    
                    // Check if field is required
                    if (this.isFieldRequired(field)) {
                        extractedSchema.required.push(fieldName);
                    }
                }
            } catch (error) {
                console.warn(`Failed to extract field ${fieldPath}:`, error.message);
                // Create a basic rule for unknown fields
                extractedSchema.properties[fieldName] = {
                    type: 'any',
                    description: `Unknown field type: ${field.constructor.name}`,
                    _foundryFieldType: field.constructor.name
                };
            }
        }

        return extractedSchema;
    }

    /**
     * Extract validation rule for a single field
     */
    extractFieldRule(field, path) {
        if (!field || !field.constructor) {
            return { type: 'any' };
        }

        const fieldTypeName = field.constructor.name;
        const extractor = this.fieldTypeMapping[fieldTypeName];
        
        if (extractor) {
            return extractor(field, path);
        }

        // Fallback for unknown field types
        console.warn(`Unknown field type: ${fieldTypeName} at ${path}`);
        return {
            type: 'any',
            description: `Unknown FoundryVTT field type: ${fieldTypeName}`,
            _foundryFieldType: fieldTypeName
        };
    }

    /**
     * Check if a field is required
     */
    isFieldRequired(field) {
        return field.required === true && field.nullable !== true;
    }

    /**
     * Extract base field properties
     */
    extractBaseProperties(field) {
        const props = {
            _foundryFieldType: field.constructor.name
        };

        if (field.label) props.title = field.label;
        if (field.hint) props.description = field.hint;
        if (field.required !== undefined) props._required = field.required;
        if (field.nullable !== undefined) props._nullable = field.nullable;
        if (field.initial !== undefined) props.default = field.initial;

        return props;
    }

    // Field type extractors

    extractBooleanField(field, path) {
        return {
            type: 'boolean',
            ...this.extractBaseProperties(field)
        };
    }

    extractNumberField(field, path) {
        const rule = {
            type: 'number',
            ...this.extractBaseProperties(field)
        };

        if (field.min !== undefined) rule.minimum = field.min;
        if (field.max !== undefined) rule.maximum = field.max;
        if (field.step !== undefined) rule.multipleOf = field.step;
        if (field.integer === true) rule.type = 'integer';
        if (field.positive === true) rule.minimum = 0;

        return rule;
    }

    extractStringField(field, path) {
        const rule = {
            type: 'string',
            ...this.extractBaseProperties(field)
        };

        if (field.blank === false) rule.minLength = 1;
        if (field.choices && Array.isArray(field.choices)) {
            rule.enum = field.choices;
        } else if (field.choices && typeof field.choices === 'object') {
            rule.enum = Object.keys(field.choices);
        }

        return rule;
    }

    extractObjectField(field, path) {
        return {
            type: 'object',
            additionalProperties: true,
            ...this.extractBaseProperties(field)
        };
    }

    extractArrayField(field, path) {
        const rule = {
            type: 'array',
            ...this.extractBaseProperties(field)
        };

        // Extract element type if available
        if (field.element) {
            rule.items = this.extractFieldRule(field.element, `${path}[]`);
        }

        if (field.initial && Array.isArray(field.initial)) {
            rule.default = field.initial;
        }

        return rule;
    }

    extractSchemaField(field, path) {
        const rule = {
            type: 'object',
            ...this.extractBaseProperties(field)
        };

        // Extract nested schema
        if (field.fields) {
            const nestedSchema = this.extractSchema(field.fields, path);
            if (nestedSchema) {
                rule.properties = nestedSchema.properties;
                rule.required = nestedSchema.required;
                rule.additionalProperties = false;
            }
        }

        return rule;
    }

    extractEmbeddedDataField(field, path) {
        const rule = {
            type: 'object',
            description: 'Embedded document data',
            ...this.extractBaseProperties(field)
        };

        // Try to extract schema from the DataModel class
        if (field.model && typeof field.model.defineSchema === 'function') {
            try {
                const embeddedSchema = field.model.defineSchema();
                const extractedSchema = this.extractSchema(embeddedSchema, path);
                if (extractedSchema) {
                    rule.properties = extractedSchema.properties;
                    rule.required = extractedSchema.required;
                    rule.additionalProperties = false;
                }
            } catch (error) {
                console.warn(`Failed to extract embedded schema at ${path}:`, error.message);
            }
        }

        return rule;
    }

    extractEmbeddedCollectionField(field, path) {
        const rule = {
            type: 'array',
            description: 'Collection of embedded documents',
            ...this.extractBaseProperties(field)
        };

        // Extract item schema if available
        if (field.element) {
            rule.items = this.extractFieldRule(field.element, `${path}[]`);
        }

        return rule;
    }

    extractTypeDataField(field, path) {
        return {
            type: 'object',
            description: 'System-specific type data (dynamic schema based on document type)',
            additionalProperties: true,
            ...this.extractBaseProperties(field)
        };
    }

    extractDocumentIdField(field, path) {
        return {
            type: 'string',
            pattern: '^[a-zA-Z0-9]{16}$',
            description: 'FoundryVTT document ID (16-character alphanumeric)',
            ...this.extractBaseProperties(field)
        };
    }

    extractFilePathField(field, path) {
        const rule = {
            type: 'string',
            description: 'File path',
            ...this.extractBaseProperties(field)
        };

        if (field.categories && field.categories.length > 0) {
            rule.description += ` (${field.categories.join(', ')})`;
        }

        return rule;
    }

    extractHTMLField(field, path) {
        return {
            type: 'string',
            description: 'HTML content',
            ...this.extractBaseProperties(field)
        };
    }

    extractJSONField(field, path) {
        return {
            type: ['object', 'array', 'string', 'number', 'boolean', 'null'],
            description: 'JSON data',
            ...this.extractBaseProperties(field)
        };
    }

    extractColorField(field, path) {
        return {
            type: 'string',
            pattern: '^#[0-9a-fA-F]{6}$',
            description: 'Hex color code',
            ...this.extractBaseProperties(field)
        };
    }

    extractAlphaField(field, path) {
        return {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Alpha transparency value',
            ...this.extractBaseProperties(field)
        };
    }

    extractAngleField(field, path) {
        return {
            type: 'number',
            minimum: 0,
            maximum: 360,
            description: 'Angle in degrees',
            ...this.extractBaseProperties(field)
        };
    }

    extractDocumentTypeField(field, path) {
        const rule = {
            type: 'string',
            description: 'Document type',
            ...this.extractBaseProperties(field)
        };

        // Try to extract valid document types from the field
        if (field.document && field.document.TYPES) {
            rule.enum = Object.keys(field.document.TYPES);
        }

        return rule;
    }

    /**
     * Create a complete schema for a document type
     */
    createCompleteSchema(baseSchema, typeSchema = null) {
        const completeSchema = {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
            _foundrySchema: true
        };

        // Merge base schema
        if (baseSchema && baseSchema.properties) {
            Object.assign(completeSchema.properties, baseSchema.properties);
            if (baseSchema.required) {
                completeSchema.required.push(...baseSchema.required);
            }
        }

        // Merge type-specific schema
        if (typeSchema && typeSchema.properties) {
            // Type data usually goes in the 'system' field
            if (completeSchema.properties.system) {
                completeSchema.properties.system = {
                    type: 'object',
                    properties: typeSchema.properties,
                    required: typeSchema.required || [],
                    additionalProperties: false
                };
            }
        }

        // Remove duplicates from required array
        completeSchema.required = [...new Set(completeSchema.required)];

        return completeSchema;
    }
}

export default SchemaExtractor;
#!/usr/bin/env node

/**
 * FoundryVTT Validation Engine
 * Validates JSON objects against extracted FoundryVTT schemas
 */

class ValidationResult {
    constructor(valid = true, errors = [], warnings = [], normalizedData = null) {
        this.valid = valid;
        this.errors = errors;
        this.warnings = warnings;
        this.normalizedData = normalizedData;
    }

    addError(path, message, value = undefined) {
        this.valid = false;
        this.errors.push({
            path: path,
            message: message,
            value: value,
            severity: 'error'
        });
    }

    addWarning(path, message, value = undefined) {
        this.warnings.push({
            path: path,
            message: message,
            value: value,
            severity: 'warning'
        });
    }

    toString() {
        if (this.valid) {
            const output = ['✓ Validation successful'];
            if (this.warnings.length > 0) {
                output.push('', 'Warnings:');
                this.warnings.forEach(warning => {
                    output.push(`  ${warning.path}: ${warning.message}`);
                });
            }
            return output.join('\n');
        } else {
            const output = ['✗ Validation failed', ''];
            output.push('Errors:');
            this.errors.forEach(error => {
                output.push(`  ${error.path}: ${error.message}`);
                if (error.value !== undefined) {
                    output.push(`    Received: ${JSON.stringify(error.value)}`);
                }
            });
            
            if (this.warnings.length > 0) {
                output.push('', 'Warnings:');
                this.warnings.forEach(warning => {
                    output.push(`  ${warning.path}: ${warning.message}`);
                });
            }
            
            return output.join('\n');
        }
    }
}

class ValidationEngine {
    constructor() {
        this.typeValidators = this.createTypeValidators();
    }

    /**
     * Create type-specific validation functions
     */
    createTypeValidators() {
        return {
            boolean: this.validateBoolean.bind(this),
            number: this.validateNumber.bind(this),
            integer: this.validateInteger.bind(this),
            string: this.validateString.bind(this),
            object: this.validateObject.bind(this),
            array: this.validateArray.bind(this),
            any: this.validateAny.bind(this)
        };
    }

    /**
     * Validate a JSON object against a schema
     */
    validate(data, schema, path = '', options = {}) {
        const result = new ValidationResult();
        
        try {
            // Parse JSON if it's a string
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (error) {
                    result.addError(path, `Invalid JSON: ${error.message}`);
                    return result;
                }
            }

            // Validate against schema
            const normalizedData = this.validateValue(data, schema, path, result, options);
            
            if (result.valid) {
                result.normalizedData = normalizedData;
            }
            
        } catch (error) {
            result.addError(path, `Validation error: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate a single value against a schema rule
     */
    validateValue(value, rule, path, result, options = {}) {
        if (!rule) {
            result.addWarning(path, 'No validation rule provided');
            return value;
        }

        // Handle null/undefined values
        if (value === null || value === undefined) {
            if (rule._required === true && rule._nullable !== true) {
                result.addError(path, 'Required field is missing');
                return value;
            }
            
            if (rule._nullable === true || rule._required !== true) {
                return rule.default !== undefined ? rule.default : value;
            }
        }

        // Handle default values
        if (value === undefined && rule.default !== undefined) {
            value = rule.default;
        }

        // Type validation
        const types = Array.isArray(rule.type) ? rule.type : [rule.type];
        let validType = false;
        let normalizedValue = value;

        for (const type of types) {
            if (type === 'any' || this.checkType(value, type)) {
                validType = true;
                
                // Apply type-specific validation
                if (this.typeValidators[type]) {
                    normalizedValue = this.typeValidators[type](value, rule, path, result, options);
                }
                break;
            }
        }

        if (!validType) {
            result.addError(path, `Expected type ${types.join(' or ')}, got ${typeof value}`, value);
            return value;
        }

        return normalizedValue;
    }

    /**
     * Check if a value matches a type
     */
    checkType(value, type) {
        switch (type) {
            case 'boolean':
                return typeof value === 'boolean';
            case 'number':
            case 'integer':
                return typeof value === 'number' && !isNaN(value);
            case 'string':
                return typeof value === 'string';
            case 'object':
                return value !== null && typeof value === 'object' && !Array.isArray(value);
            case 'array':
                return Array.isArray(value);
            case 'null':
                return value === null;
            case 'any':
                return true;
            default:
                return false;
        }
    }

    // Type-specific validators

    validateBoolean(value, rule, path, result, options) {
        // Type coercion if enabled
        if (options.coerceTypes && typeof value !== 'boolean') {
            if (typeof value === 'string') {
                if (value.toLowerCase() === 'true' || value === '1') return true;
                if (value.toLowerCase() === 'false' || value === '0') return false;
            }
            if (typeof value === 'number') {
                return Boolean(value);
            }
        }
        return value;
    }

    validateNumber(value, rule, path, result, options) {
        const num = Number(value);
        
        if (isNaN(num)) {
            result.addError(path, 'Value must be a valid number', value);
            return value;
        }

        // Check constraints
        if (rule.minimum !== undefined && num < rule.minimum) {
            result.addError(path, `Value must be >= ${rule.minimum}`, value);
        }
        
        if (rule.maximum !== undefined && num > rule.maximum) {
            result.addError(path, `Value must be <= ${rule.maximum}`, value);
        }
        
        if (rule.multipleOf !== undefined && num % rule.multipleOf !== 0) {
            result.addError(path, `Value must be a multiple of ${rule.multipleOf}`, value);
        }

        return num;
    }

    validateInteger(value, rule, path, result, options) {
        const num = this.validateNumber(value, rule, path, result, options);
        
        if (!Number.isInteger(num)) {
            result.addError(path, 'Value must be an integer', value);
        }
        
        return Math.floor(num);
    }

    validateString(value, rule, path, result, options) {
        const str = String(value);
        
        // Check length constraints
        if (rule.minLength !== undefined && str.length < rule.minLength) {
            result.addError(path, `String must be at least ${rule.minLength} characters long`, value);
        }
        
        if (rule.maxLength !== undefined && str.length > rule.maxLength) {
            result.addError(path, `String must be at most ${rule.maxLength} characters long`, value);
        }
        
        // Check enum values
        if (rule.enum && !rule.enum.includes(str)) {
            result.addError(path, `Value must be one of: ${rule.enum.join(', ')}`, value);
        }
        
        // Check pattern
        if (rule.pattern) {
            const regex = new RegExp(rule.pattern);
            if (!regex.test(str)) {
                result.addError(path, `Value does not match required pattern: ${rule.pattern}`, value);
            }
        }

        return str;
    }

    validateObject(value, rule, path, result, options) {
        if (!this.checkType(value, 'object')) {
            result.addError(path, 'Value must be an object', value);
            return value;
        }

        const normalizedObject = {};
        const processedKeys = new Set();

        // Validate known properties
        if (rule.properties) {
            for (const [propName, propRule] of Object.entries(rule.properties)) {
                const propPath = path ? `${path}.${propName}` : propName;
                const propValue = value[propName];
                
                normalizedObject[propName] = this.validateValue(propValue, propRule, propPath, result, options);
                processedKeys.add(propName);
            }
        }

        // Check for required properties
        if (rule.required) {
            for (const requiredProp of rule.required) {
                if (!(requiredProp in value)) {
                    const propPath = path ? `${path}.${requiredProp}` : requiredProp;
                    result.addError(propPath, 'Required property is missing');
                }
            }
        }

        // Handle additional properties
        if (rule.additionalProperties === false) {
            for (const key of Object.keys(value)) {
                if (!processedKeys.has(key)) {
                    const propPath = path ? `${path}.${key}` : key;
                    result.addWarning(propPath, 'Additional property not allowed in schema');
                }
            }
        } else if (rule.additionalProperties !== true) {
            // Copy unprocessed properties
            for (const [key, val] of Object.entries(value)) {
                if (!processedKeys.has(key)) {
                    normalizedObject[key] = val;
                }
            }
        }

        return normalizedObject;
    }

    validateArray(value, rule, path, result, options) {
        if (!Array.isArray(value)) {
            result.addError(path, 'Value must be an array', value);
            return value;
        }

        const normalizedArray = [];

        // Validate array items
        if (rule.items) {
            value.forEach((item, index) => {
                const itemPath = `${path}[${index}]`;
                normalizedArray[index] = this.validateValue(item, rule.items, itemPath, result, options);
            });
        } else {
            normalizedArray.push(...value);
        }

        // Check length constraints
        if (rule.minItems !== undefined && normalizedArray.length < rule.minItems) {
            result.addError(path, `Array must have at least ${rule.minItems} items`);
        }
        
        if (rule.maxItems !== undefined && normalizedArray.length > rule.maxItems) {
            result.addError(path, `Array must have at most ${rule.maxItems} items`);
        }

        return normalizedArray;
    }

    validateAny(value, rule, path, result, options) {
        return value; // Accept any value
    }

    /**
     * Prettify JSON output
     */
    prettifyJSON(data) {
        return JSON.stringify(data, null, 2);
    }

    /**
     * Generate a human-readable validation report
     */
    generateReport(result, inputData, schema) {
        const report = {
            timestamp: new Date().toISOString(),
            status: result.valid ? 'PASSED' : 'FAILED',
            summary: {
                errors: result.errors.length,
                warnings: result.warnings.length
            }
        };

        if (result.valid) {
            report.message = 'JSON object is valid according to the schema';
            if (result.normalizedData) {
                report.normalizedData = result.normalizedData;
            }
        } else {
            report.message = 'JSON object failed validation';
            report.errors = result.errors;
        }

        if (result.warnings.length > 0) {
            report.warnings = result.warnings;
        }

        return report;
    }
}

export default ValidationEngine;
export { ValidationResult };
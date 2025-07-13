/**
 * Template compilation options
 */
export interface CompileOptions {
  /** Block name to compile specific block */
  block?: string;
  /** Enable/disable caching */
  cache?: boolean;
  /** Cache directory name */
  cacheName?: string;
}

/**
 * Template data object - can be any object type
 */
export type TemplateData = Record<string, any>;

/**
 * Compiled template function
 */
export interface CompiledTemplate {
  (data?: TemplateData, subTemplate?: string): string;
}

/**
 * Template rendering callback
 */
export interface RenderCallback {
  (error: Error | null, result?: string): void;
}

/**
 * Template compilation callback
 */
export interface CompileCallback {
  (error: Error | null, templateFunction?: CompiledTemplate): void;
}

/**
 * Main template engine interface
 */
export interface CBTemplate {
  /** Template engine version */
  version: string;
  
  /** Left delimiter for template syntax */
  leftDelimiter: string;
  
  /** Right delimiter for template syntax */
  rightDelimiter: string;
  
  /** Default HTML escaping setting */
  escape: boolean;
  
  /** Base path for template files */
  basePath: string;
  
  /** Cache path for compiled templates */
  cachePath: string;
  
  /** Default file extension */
  defaultExtName: string;

  /**
   * Compile template string to function
   * @param str Template string
   * @returns Compiled template function
   */
  compile(str: string): CompiledTemplate;

  /**
   * Render template string with data
   * @param str Template string
   * @param data Template data
   * @param subTemplate Sub template name
   * @returns Rendered string
   */
  render(str: string, data?: TemplateData, subTemplate?: string): string;

  /**
   * Compile template file with inheritance support
   * @param filename Template file path
   * @param options Compilation options
   * @param callback Compilation callback
   */
  compileFile(filename: string, options: CompileOptions, callback: CompileCallback): void;
  compileFile(filename: string, callback: CompileCallback): void;

  /**
   * Render template file with data and inheritance support
   * @param filename Template file path
   * @param data Template data
   * @param options Render options
   * @param callback Render callback
   */
  renderFile(filename: string, data: TemplateData, options: CompileOptions, callback: RenderCallback): void;
  renderFile(filename: string, data: TemplateData, callback: RenderCallback): void;

  /**
   * Get new instance of template engine
   * @returns New template engine instance
   */
  getInstance(): CBTemplate;

  /** Internal parse method */
  _parse(str: string): string;
  
  /** Internal build template function method */
  _buildTemplateFunction(str: string): CompiledTemplate;
}

/**
 * Template engine instance with static methods
 */
export interface CBTemplateStatic extends CBTemplate {
  /**
   * Get new instance of template engine
   * @returns New template engine instance
   */
  getInstance(): CBTemplate;
}

declare const cbTemplate: CBTemplateStatic;
export default cbTemplate;
/**
 * @file Tree
 * @description 树形组件
 * @author fex
 */

import React from 'react';
import {
  eachTree,
  isVisible,
  autobind,
  findTreeIndex,
  hasAbility,
  createObject
} from '../utils/helper';
import {Option, Options, value2array} from './Checkboxes';
import {ClassNamesFn, themeable} from '../theme';
import {highlight} from '../renderers/Form/Options';
import {Icon} from './icons';
import Checkbox from './Checkbox';

interface TreeSelectorProps {
  classPrefix: string;
  classnames: ClassNamesFn;

  highlightTxt?: string;

  showIcon?: boolean;
  // 是否默认都展开
  initiallyOpen?: boolean;
  // 默认展开的级数，从1开始，只有initiallyOpen不是true时生效
  unfoldedLevel?: number;
  // 单选时，是否展示radio
  showRadio?: boolean;
  multiple?: boolean;
  // 是否都不可用
  disabled?: boolean;
  // 多选时，选中父节点时，是否将其所有子节点也融合到取值中，默认是不融合
  withChildren?: boolean;
  // 多选时，选中父节点时，是否只将起子节点加入到值中。
  onlyChildren?: boolean;
  // 名称、取值等字段名映射
  labelField: string;
  valueField: string;
  iconField: string;
  unfoldedField: string;
  foldedField: string;
  disabledField: string;

  className?: string;
  itemClassName?: string;
  joinValues?: boolean;
  extractValue?: boolean;
  delimiter?: string;
  options: Options;
  value: any;
  onChange: Function;
  placeholder?: string;
  hideRoot?: boolean;
  rootLabel?: string;
  rootValue?: any;
  cascade?: boolean;
  selfDisabledAffectChildren?: boolean;
  minLength?: number;
  maxLength?: number;

  // 是否为内建 增、改、删。当有复杂表单的时候直接抛出去让外层能统一处理
  bultinCUD?: boolean;
  rootCreatable?: boolean;
  creatable?: boolean;
  onAdd?: (
    idx?: number | Array<number>,
    value?: any,
    skipForm?: boolean
  ) => void;
  editable?: boolean;
  onEdit?: (value: Option, origin?: Option, skipForm?: boolean) => void;
  removable?: boolean;
  onDelete?: (value: Option) => void;
}

interface TreeSelectorState {
  value: Array<any>;
  unfolded: {[propName: string]: string};

  inputValue: string;
  addingParent: Option | null;
  isAdding: boolean;
  isEditing: boolean;
  editingItem: Option | null;
}

export class TreeSelector extends React.Component<
  TreeSelectorProps,
  TreeSelectorState
> {
  static defaultProps = {
    showIcon: true,
    initiallyOpen: true,
    unfoldedLevel: 0,
    showRadio: false,
    multiple: false,
    disabled: false,
    withChildren: false,
    onlyChildren: false,
    labelField: 'label',
    valueField: 'value',
    iconField: 'icon',
    unfoldedField: 'unfolded',
    foldedField: 'foled',
    disabledField: 'disabled',
    joinValues: true,
    extractValue: false,
    delimiter: ',',
    hideRoot: true,
    rootLabel: '顶级',
    rootValue: 0,
    cascade: false,
    selfDisabledAffectChildren: true
  };

  componentWillMount() {
    const props = this.props;

    this.setState({
      value: value2array(props.value, {
        joinValues: props.joinValues,
        extractValue: props.extractValue,
        multiple: props.multiple,
        delimiter: props.delimiter,
        valueField: props.valueField,
        options: props.options
      }),
      unfolded: this.syncUnFolded(props),

      inputValue: '',
      addingParent: null,
      isAdding: false,
      isEditing: false,
      editingItem: null
    });
  }

  componentWillReceiveProps(nextProps: TreeSelectorProps) {
    const toUpdate: any = {};

    if (
      this.props.value !== nextProps.value ||
      this.props.options !== nextProps.options
    ) {
      toUpdate.value = value2array(nextProps.value, {
        joinValues: nextProps.joinValues,
        extractValue: nextProps.extractValue,
        multiple: nextProps.multiple,
        delimiter: nextProps.delimiter,
        valueField: nextProps.valueField,
        options: nextProps.options
      });
    }

    if (this.props.options !== nextProps.options) {
      toUpdate.unfolded = this.syncUnFolded(nextProps);
    }

    this.setState(toUpdate);
  }

  syncUnFolded(props: TreeSelectorProps) {
    // 初始化树节点的展开状态
    let unfolded: {[propName: string]: string} = {};
    const {foldedField, unfoldedField} = this.props;

    eachTree(props.options, (node: Option, index, level) => {
      if (node.children && node.children.length) {
        let ret: any = true;

        if (unfoldedField && typeof node[unfoldedField] !== 'undefined') {
          ret = !!node[unfoldedField];
        } else if (foldedField && typeof node[foldedField] !== 'undefined') {
          ret = !node[foldedField];
        } else {
          ret = !!props.initiallyOpen;
          if (!ret && level <= (props.unfoldedLevel as number)) {
            ret = true;
          }
        }
        unfolded[node[props.valueField as string]] = ret;
      }
    });

    return unfolded;
  }

  @autobind
  toggleUnfolded(node: any) {
    this.setState({
      unfolded: {
        ...this.state.unfolded,
        [node[this.props.valueField as string]]: !this.state.unfolded[
          node[this.props.valueField as string]
        ]
      }
    });
  }

  @autobind
  clearSelect() {
    this.setState(
      {
        value: []
      },
      () => {
        const {joinValues, rootValue, onChange} = this.props;

        onChange(joinValues ? rootValue : []);
      }
    );
  }

  @autobind
  handleSelect(node: any, value?: any) {
    this.setState(
      {
        value: [node]
      },
      () => {
        const {joinValues, valueField, onChange} = this.props;

        onChange(joinValues ? node[valueField as string] : node);
      }
    );
  }

  @autobind
  handleCheck(item: any, checked: boolean) {
    const props = this.props;
    const value = this.state.value.concat();
    const idx = value.indexOf(item);
    const onlyChildren = this.props.onlyChildren;

    if (checked) {
      ~idx || value.push(item);
      if (!props.cascade) {
        const children = item.children ? item.children.concat([]) : [];

        if (onlyChildren) {
          // 父级选中的时候，子节点也都选中，但是自己不选中
          !~idx && children.length && value.shift();

          while (children.length) {
            let child = children.shift();
            let index = value.indexOf(child);

            if (child.children) {
              children.push.apply(children, child.children);
            } else {
              ~index || value.push(child);
            }
          }
        } else {
          // 只要父节点选择了,子节点就不需要了,全部去掉勾选.  withChildren时相反
          while (children.length) {
            let child = children.shift();
            let index = value.indexOf(child);

            if (~index) {
              value.splice(index, 1);
            }

            if (props.withChildren) {
              value.push(child);
            }

            if (child.children && child.children.length) {
              children.push.apply(children, child.children);
            }
          }
        }
      }
    } else if (!checked) {
      ~idx && value.splice(idx, 1);

      if (!props.cascade && (props.withChildren || onlyChildren)) {
        const children = item.children ? item.children.concat([]) : [];
        while (children.length) {
          let child = children.shift();
          let index = value.indexOf(child);

          if (~index) {
            value.splice(index, 1);
          }

          if (child.children && child.children.length) {
            children.push.apply(children, child.children);
          }
        }
      }
    }

    this.setState(
      {
        value
      },
      () => {
        const {
          joinValues,
          extractValue,
          valueField,
          delimiter,
          onChange
        } = this.props;

        onChange(
          joinValues
            ? value.map(item => item[valueField as string]).join(delimiter)
            : extractValue
            ? value.map(item => item[valueField as string])
            : value
        );
      }
    );
  }

  @autobind
  handleAdd(parent: Option | null = null) {
    const {bultinCUD, onAdd, options} = this.props;
    let idx: Array<number> | undefined = undefined;

    if (!bultinCUD) {
      idx = parent
        ? findTreeIndex(options, item => item === parent)
        : undefined;
      return onAdd && onAdd(idx);
    } else {
      this.setState({
        isEditing: false,
        isAdding: true,
        addingParent: parent
      });
    }
  }

  @autobind
  handleEdit(item: Option) {
    const labelField = this.props.labelField;
    this.setState({
      isEditing: true,
      isAdding: false,
      editingItem: item,
      inputValue: item[labelField]
    });
  }

  @autobind
  handleRemove(item: Option) {
    const {onDelete} = this.props;

    onDelete && onDelete(item);
  }

  @autobind
  handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({
      inputValue: e.currentTarget.value
    });
  }

  @autobind
  handleConfirm() {
    const {
      inputValue: value,
      isAdding,
      addingParent,
      editingItem,
      isEditing
    } = this.state;

    if (!value) {
      return;
    }

    const {labelField, onAdd, options, onEdit} = this.props;
    this.setState(
      {
        inputValue: '',
        isAdding: false,
        isEditing: false
      },
      () => {
        if (isAdding && onAdd) {
          let idx =
            (addingParent &&
              findTreeIndex(options, item => item === addingParent)) ||
            [];
          onAdd(idx.concat(0), {[labelField]: value}, true);
        } else if (isEditing && onEdit) {
          onEdit(
            {
              ...editingItem,
              [labelField]: value
            },
            editingItem!,
            true
          );
        }
      }
    );
  }

  @autobind
  handleCancel() {
    this.setState({
      inputValue: '',
      isAdding: false,
      isEditing: false
    });
  }

  renderInput(prfix: JSX.Element | null = null) {
    const {classnames: cx} = this.props;
    const {inputValue} = this.state;

    return (
      <div className={cx('Tree-itemLabel')}>
        <div className={cx('Tree-itemInput')}>
          {prfix}
          <input
            onChange={this.handleInputChange}
            value={inputValue}
            placeholder="请输入"
          />
          <a data-tooltip="取消" onClick={this.handleCancel}>
            <Icon icon="close" className="icon" />
          </a>
          <a data-tooltip="确认" onClick={this.handleConfirm}>
            <Icon icon="check" className="icon" />
          </a>
        </div>
      </div>
    );
  }

  @autobind
  renderList(
    list: Options,
    value: Option[],
    uncheckable: boolean
  ): {dom: Array<JSX.Element | null>; childrenChecked: number} {
    const {
      itemClassName,
      showIcon,
      showRadio,
      multiple,
      disabled,
      labelField,
      valueField,
      iconField,
      disabledField,
      cascade,
      selfDisabledAffectChildren,
      onlyChildren,
      classnames: cx,
      highlightTxt,
      options,
      maxLength,
      minLength,
      creatable,
      editable,
      removable
    } = this.props;
    const {
      unfolded,
      value: stateValue,
      isAdding,
      addingParent,
      editingItem,
      isEditing
    } = this.state;

    let childrenChecked = 0;
    let ret = list.map((item, key) => {
      if (!isVisible(item as any, options)) {
        return null;
      }

      const checked = !!~value.indexOf(item);
      const selfDisabled = item[disabledField];
      let selfChecked = !!uncheckable || checked;

      let childrenItems = null;
      let tmpChildrenChecked = false;
      if (item.children && item.children.length) {
        childrenItems = this.renderList(
          item.children,
          value,
          cascade
            ? false
            : uncheckable ||
                (selfDisabledAffectChildren ? selfDisabled : false) ||
                (multiple && checked)
        );
        tmpChildrenChecked = !!childrenItems.childrenChecked;
        if (
          !selfChecked &&
          onlyChildren &&
          item.children.length === childrenItems.childrenChecked
        ) {
          selfChecked = true;
        }
        childrenItems = childrenItems.dom;
      }

      if (tmpChildrenChecked || checked) {
        childrenChecked++;
      }

      let nodeDisabled = !!uncheckable || !!disabled || selfDisabled;

      if (
        !nodeDisabled &&
        ((maxLength && !selfChecked && stateValue.length >= maxLength) ||
          (minLength && selfChecked && stateValue.length <= minLength))
      ) {
        nodeDisabled = true;
      }

      const checkbox: JSX.Element | null = multiple ? (
        <Checkbox
          size="sm"
          disabled={nodeDisabled}
          checked={checked}
          onChange={this.handleCheck.bind(this, item)}
        />
      ) : showRadio ? (
        <Checkbox
          size="sm"
          disabled={nodeDisabled}
          checked={checked}
          onChange={this.handleSelect.bind(this, item)}
        />
      ) : null;

      const isLeaf = !item.children || !item.children.length;

      return (
        <li
          key={key}
          className={cx(`Tree-item ${itemClassName || ''}`, {
            'Tree-item--isLeaf': isLeaf
          })}
        >
          {isEditing && editingItem === item ? (
            this.renderInput(checkbox)
          ) : (
            <div
              className={cx('Tree-itemLabel', {
                'is-children-checked':
                  multiple && !cascade && tmpChildrenChecked && !nodeDisabled,
                'is-checked': checked,
                'is-disabled': nodeDisabled
              })}
            >
              {!isLeaf ? (
                <i
                  onClick={() => this.toggleUnfolded(item)}
                  className={cx('Tree-itemArrow', {
                    'is-folded': !unfolded[item[valueField]]
                  })}
                />
              ) : (
                <span className={cx('Tree-itemArrowPlaceholder')} />
              )}

              {checkbox}

              <span
                className={cx('Tree-itemText')}
                onClick={() =>
                  !nodeDisabled &&
                  (multiple
                    ? this.handleCheck(item, !selfChecked)
                    : this.handleSelect(item))
                }
              >
                {showIcon ? (
                  <i
                    className={cx(
                      `Tree-itemIcon ${item[iconField] ||
                        (childrenItems ? 'Tree-folderIcon' : 'Tree-leafIcon')}`
                    )}
                  />
                ) : null}

                {highlightTxt
                  ? highlight(item[labelField], highlightTxt)
                  : item[labelField]}
              </span>

              {!nodeDisabled && !isAdding && !isEditing ? (
                <div className={cx('Tree-item-icons')}>
                  {creatable && hasAbility(item, 'creatable') ? (
                    <a
                      onClick={this.handleAdd.bind(this, item)}
                      data-tooltip="添加孩子节点"
                    >
                      <Icon icon="plus" className="icon" />
                    </a>
                  ) : null}

                  {removable && hasAbility(item, 'removable') ? (
                    <a
                      onClick={this.handleRemove.bind(this, item)}
                      data-tooltip="移除该节点"
                    >
                      <Icon icon="minus" className="icon" />
                    </a>
                  ) : null}

                  {editable && hasAbility(item, 'editable') ? (
                    <a
                      onClick={this.handleEdit.bind(this, item)}
                      data-tooltip="编辑该节点"
                    >
                      <Icon icon="pencil" className="icon" />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          {/* 有children而且为展开状态 或者 添加child时 */}
          {(childrenItems && unfolded[item[valueField]]) ||
          (isAdding && addingParent === item) ? (
            <ul className={cx('Tree-sublist')}>
              {isAdding && addingParent === item ? (
                <li className={cx('Tree-item')}>
                  {this.renderInput(
                    checkbox
                      ? React.cloneElement(checkbox, {
                          checked: false,
                          disabled: true
                        })
                      : null
                  )}
                </li>
              ) : null}
              {childrenItems}
            </ul>
          ) : null}
        </li>
      );
    });

    return {
      dom: ret,
      childrenChecked
    };
  }

  render() {
    const {
      className,
      placeholder,
      hideRoot,
      rootLabel,
      showIcon,
      classnames: cx,
      creatable,
      rootCreatable,
      disabled
    } = this.props;
    let options = this.props.options;
    const {value, isAdding, addingParent, isEditing, inputValue} = this.state;

    let addBtn = null;

    if (creatable && hideRoot) {
      addBtn = (
        <a
          className={cx('Tree-addTopBtn', {
            'is-disabled': isAdding || isEditing
          })}
          onClick={this.handleAdd.bind(this, null)}
        >
          <Icon icon="plus" className="icon" />
          <span>添加一级节点</span>
        </a>
      );
    }

    return (
      <div className={cx(`Tree ${className || ''}`)}>
        {options && options.length ? (
          <ul className={cx('Tree-list')}>
            {hideRoot ? (
              <>
                {addBtn}
                {isAdding && !addingParent ? (
                  <li className={cx('Tree-item')}>{this.renderInput()}</li>
                ) : null}
                {this.renderList(options, value, false).dom}
              </>
            ) : (
              <li
                className={cx('Tree-rootItem', {
                  'is-checked': !value || !value.length
                })}
              >
                <div className={cx('Tree-itemLabel')}>
                  <span className={cx('Tree-itemText')}>
                    {showIcon ? (
                      <i className={cx('Tree-itemIcon Tree-rootIcon')} />
                    ) : null}
                    {rootLabel}
                  </span>
                  {!disabled &&
                  creatable &&
                  rootCreatable !== false &&
                  !isAdding &&
                  !isEditing ? (
                    <div className={cx('Tree-item-icons')}>
                      {creatable ? (
                        <a
                          onClick={this.handleAdd.bind(this, null)}
                          data-tooltip="添加一级节点"
                        >
                          <Icon icon="plus" className="icon" />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <ul className={cx('Tree-sublist')}>
                  {isAdding && !addingParent ? (
                    <li className={cx('Tree-item')}>{this.renderInput()}</li>
                  ) : null}
                  {this.renderList(options, value, false).dom}
                </ul>
              </li>
            )}
          </ul>
        ) : (
          <div className={cx('Tree-placeholder')}>{placeholder}</div>
        )}
      </div>
    );
  }
}

export default themeable(TreeSelector);
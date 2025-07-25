# Part of CashApp. See LICENSE file for full copyright and licensing details.
from __future__ import annotations
import typing
from inspect import Parameter, getsourcefile, signature

from decorator import decorator

__all__ = [
    'classproperty',
    'conditional',
    'lazy',
    'lazy_classproperty',
    'lazy_property',
    'synchronized',
]

T = typing.TypeVar("T")

if typing.TYPE_CHECKING:
    from collections.abc import Callable


class lazy_property(typing.Generic[T]):
    """ Decorator for a lazy property of an object, i.e., an object attribute
        that is determined by the result of a method call evaluated once. To
        reevaluate the property, simply delete the attribute on the object, and
        get it again.
    """
    def __init__(self, fget: Callable[[typing.Any], T]):
        assert not fget.__name__.startswith('__'),\
            "lazy_property does not support mangled names"
        self.fget = fget

    @typing.overload
    def __get__(self, obj: None, cls: typing.Any, /) -> typing.Any: ...
    @typing.overload
    def __get__(self, obj: object, cls: typing.Any, /) -> T: ...

    def __get__(self, obj, cls, /):
        if obj is None:
            return self
        value = self.fget(obj)
        setattr(obj, self.fget.__name__, value)
        return value

    @property
    def __doc__(self):
        return self.fget.__doc__

    @staticmethod
    def reset_all(obj) -> None:
        """ Reset all lazy properties on the instance `obj`. """
        cls = type(obj)
        obj_dict = vars(obj)
        for name in list(obj_dict):
            if isinstance(getattr(cls, name, None), lazy_property):
                obj_dict.pop(name)


def conditional(condition, decorator):
    """ Decorator for a conditionally applied decorator.

        Example::

           @conditional(get_config('use_cache'), ormcache)
           def fn():
               pass
    """
    if condition:
        return decorator
    else:
        return lambda fn: fn


def filter_kwargs(func: Callable, kwargs: dict[str, typing.Any]) -> dict[str, typing.Any]:
    """ Filter the given keyword arguments to only return the kwargs
        that binds to the function's signature.
    """
    leftovers = set(kwargs)
    for p in signature(func).parameters.values():
        if p.kind in (Parameter.POSITIONAL_OR_KEYWORD, Parameter.KEYWORD_ONLY):
            leftovers.discard(p.name)
        elif p.kind == Parameter.VAR_KEYWORD:  # **kwargs
            leftovers.clear()
            break

    if not leftovers:
        return kwargs

    return {key: kwargs[key] for key in kwargs if key not in leftovers}


def synchronized(lock_attr: str = '_lock'):
    @decorator
    def locked(func, inst, *args, **kwargs):
        with getattr(inst, lock_attr):
            return func(inst, *args, **kwargs)
    return locked


locked = synchronized()


def frame_codeinfo(fframe, back=0):
    """ Return a (filename, line) pair for a previous frame .
        @return (filename, lineno) where lineno is either int or string==''
    """
    try:
        if not fframe:
            return "<unknown>", ''
        for i in range(back):
            fframe = fframe.f_back
        try:
            fname = getsourcefile(fframe)
        except TypeError:
            fname = '<builtin>'
        lineno = fframe.f_lineno or ''
        return fname, lineno
    except Exception:
        return "<unknown>", ''


class classproperty(typing.Generic[T]):
    def __init__(self, fget: Callable[[typing.Any], T]) -> None:
        self.fget = classmethod(fget)

    def __get__(self, cls, owner: type | None = None, /) -> T:
        return self.fget.__get__(None, owner)()

    @property
    def __doc__(self):
        return self.fget.__doc__


class lazy_classproperty(classproperty[T], typing.Generic[T]):
    """ Similar to :class:`lazy_property`, but for classes. """
    def __get__(self, cls, owner: type | None = None, /) -> T:
        val = super().__get__(cls, owner)
        setattr(owner, self.fget.__name__, val)
        return val


class lazy(object):
    """ A proxy to the (memoized) result of a lazy evaluation:

    .. code-block::

        foo = lazy(func, arg)           # func(arg) is not called yet
        bar = foo + 1                   # eval func(arg) and add 1
        baz = foo + 2                   # use result of func(arg) and add 2
    """
    __slots__ = ['_func', '_args', '_kwargs', '_cached_value']

    def __init__(self, func, *args, **kwargs):
        # bypass own __setattr__
        object.__setattr__(self, '_func', func)
        object.__setattr__(self, '_args', args)
        object.__setattr__(self, '_kwargs', kwargs)

    @property
    def _value(self):
        if self._func is not None:
            value = self._func(*self._args, **self._kwargs)
            object.__setattr__(self, '_func', None)
            object.__setattr__(self, '_args', None)
            object.__setattr__(self, '_kwargs', None)
            object.__setattr__(self, '_cached_value', value)
        return self._cached_value

    def __getattr__(self, name): return getattr(self._value, name)
    def __setattr__(self, name, value): return setattr(self._value, name, value)
    def __delattr__(self, name): return delattr(self._value, name)

    def __repr__(self):
        return repr(self._value) if self._func is None else object.__repr__(self)
    def __str__(self): return str(self._value)
    def __bytes__(self): return bytes(self._value)
    def __format__(self, format_spec): return format(self._value, format_spec)

    def __lt__(self, other): return other > self._value
    def __le__(self, other): return other >= self._value
    def __eq__(self, other): return other == self._value
    def __ne__(self, other): return other != self._value
    def __gt__(self, other): return other < self._value
    def __ge__(self, other): return other <= self._value

    def __hash__(self): return hash(self._value)
    def __bool__(self): return bool(self._value)

    def __call__(self, *args, **kwargs): return self._value(*args, **kwargs)

    def __len__(self): return len(self._value)
    def __getitem__(self, key): return self._value[key]
    def __missing__(self, key): return self._value.__missing__(key)
    def __setitem__(self, key, value): self._value[key] = value
    def __delitem__(self, key): del self._value[key]
    def __iter__(self): return iter(self._value)
    def __reversed__(self): return reversed(self._value)
    def __contains__(self, key): return key in self._value

    def __add__(self, other): return self._value.__add__(other)
    def __sub__(self, other): return self._value.__sub__(other)
    def __mul__(self, other): return self._value.__mul__(other)
    def __matmul__(self, other): return self._value.__matmul__(other)
    def __truediv__(self, other): return self._value.__truediv__(other)
    def __floordiv__(self, other): return self._value.__floordiv__(other)
    def __mod__(self, other): return self._value.__mod__(other)
    def __divmod__(self, other): return self._value.__divmod__(other)
    def __pow__(self, other): return self._value.__pow__(other)
    def __lshift__(self, other): return self._value.__lshift__(other)
    def __rshift__(self, other): return self._value.__rshift__(other)
    def __and__(self, other): return self._value.__and__(other)
    def __xor__(self, other): return self._value.__xor__(other)
    def __or__(self, other): return self._value.__or__(other)

    def __radd__(self, other): return self._value.__radd__(other)
    def __rsub__(self, other): return self._value.__rsub__(other)
    def __rmul__(self, other): return self._value.__rmul__(other)
    def __rmatmul__(self, other): return self._value.__rmatmul__(other)
    def __rtruediv__(self, other): return self._value.__rtruediv__(other)
    def __rfloordiv__(self, other): return self._value.__rfloordiv__(other)
    def __rmod__(self, other): return self._value.__rmod__(other)
    def __rdivmod__(self, other): return self._value.__rdivmod__(other)
    def __rpow__(self, other): return self._value.__rpow__(other)
    def __rlshift__(self, other): return self._value.__rlshift__(other)
    def __rrshift__(self, other): return self._value.__rrshift__(other)
    def __rand__(self, other): return self._value.__rand__(other)
    def __rxor__(self, other): return self._value.__rxor__(other)
    def __ror__(self, other): return self._value.__ror__(other)

    def __iadd__(self, other): return self._value.__iadd__(other)
    def __isub__(self, other): return self._value.__isub__(other)
    def __imul__(self, other): return self._value.__imul__(other)
    def __imatmul__(self, other): return self._value.__imatmul__(other)
    def __itruediv__(self, other): return self._value.__itruediv__(other)
    def __ifloordiv__(self, other): return self._value.__ifloordiv__(other)
    def __imod__(self, other): return self._value.__imod__(other)
    def __ipow__(self, other): return self._value.__ipow__(other)
    def __ilshift__(self, other): return self._value.__ilshift__(other)
    def __irshift__(self, other): return self._value.__irshift__(other)
    def __iand__(self, other): return self._value.__iand__(other)
    def __ixor__(self, other): return self._value.__ixor__(other)
    def __ior__(self, other): return self._value.__ior__(other)

    def __neg__(self): return self._value.__neg__()
    def __pos__(self): return self._value.__pos__()
    def __abs__(self): return self._value.__abs__()
    def __invert__(self): return self._value.__invert__()

    def __complex__(self): return complex(self._value)
    def __int__(self): return int(self._value)
    def __float__(self): return float(self._value)

    def __index__(self): return self._value.__index__()

    def __round__(self): return self._value.__round__()
    def __trunc__(self): return self._value.__trunc__()
    def __floor__(self): return self._value.__floor__()
    def __ceil__(self): return self._value.__ceil__()

    def __enter__(self): return self._value.__enter__()
    def __exit__(self, exc_type, exc_value, traceback):
        return self._value.__exit__(exc_type, exc_value, traceback)

    def __await__(self): return self._value.__await__()
    def __aiter__(self): return self._value.__aiter__()
    def __anext__(self): return self._value.__anext__()
    def __aenter__(self): return self._value.__aenter__()
    def __aexit__(self, exc_type, exc_value, traceback):
        return self._value.__aexit__(exc_type, exc_value, traceback)

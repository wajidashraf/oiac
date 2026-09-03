(function () {
  'use strict'

  var STORAGE_KEY = 'oiac.registrationProfile.pending.v1'
  var PAYLOAD_VERSION = 1
  var MAX_AGE_MS = 30 * 60 * 1000
  var MAX_NAME_LENGTH = 50

  function removePendingProfile() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch (_error) {
      // Registration must remain available when browser storage is disabled.
    }
  }

  function readPendingProfile() {
    var raw

    try {
      raw = window.sessionStorage.getItem(STORAGE_KEY)
    } catch (_error) {
      return null
    }

    if (!raw) return null

    try {
      var payload = JSON.parse(raw)
      var isValid = payload &&
        payload.version === PAYLOAD_VERSION &&
        typeof payload.firstName === 'string' &&
        payload.firstName.trim().length > 0 &&
        typeof payload.lastName === 'string' &&
        payload.lastName.trim().length > 0 &&
        typeof payload.createdAt === 'number' &&
        Number.isFinite(payload.createdAt) &&
        payload.createdAt <= Date.now() &&
        Date.now() - payload.createdAt <= MAX_AGE_MS

      if (!isValid) {
        removePendingProfile()
        return null
      }

      return payload
    } catch (_error) {
      removePendingProfile()
      return null
    }
  }

  function createNameRow(options) {
    var row = document.createElement('div')
    row.id = options.rowId
    row.className = 'row mb-3 registration-profile-field'

    var label = document.createElement('label')
    label.className = 'col-sm-4 col-form-label required'
    label.htmlFor = options.inputId
    label.textContent = options.label + ' *'

    var control = document.createElement('div')
    control.className = 'col-sm-8'

    var input = document.createElement('input')
    input.id = options.inputId
    input.name = options.inputId
    input.type = 'text'
    input.className = 'form-control'
    input.autocomplete = options.autocomplete
    input.required = true
    input.maxLength = MAX_NAME_LENGTH
    input.setAttribute('aria-describedby', options.errorId)

    var error = document.createElement('span')
    error.id = options.errorId
    error.className = 'field-validation-error registration-profile-field__error'
    error.setAttribute('role', 'alert')
    error.hidden = true

    control.appendChild(input)
    control.appendChild(error)
    row.appendChild(label)
    row.appendChild(control)

    return {
      row: row,
      input: input,
      error: error,
      requiredMessage: options.label + ' is required.',
      tooLongMessage: options.label + ' must be 50 characters or fewer.',
    }
  }

  function setValidation(field) {
    var value = field.input.value.trim()
    var message = ''
    if (!value) message = field.requiredMessage
    else if (value.length > MAX_NAME_LENGTH) message = field.tooLongMessage

    var isValid = !message
    field.input.setAttribute('aria-invalid', isValid ? 'false' : 'true')
    field.error.textContent = message
    field.error.hidden = isValid
    return isValid
  }

  function initialize() {
    var form = document.getElementById('Register')
    var emailInput = document.getElementById('EmailTextBox')
    if (!form || !emailInput || document.getElementById('RegistrationFirstName')) return

    var emailRow = emailInput.closest('.row.mb-3, .form-group, .row')
    if (!emailRow || !emailRow.parentNode) return

    var firstName = createNameRow({
      rowId: 'registration-first-name-row',
      inputId: 'RegistrationFirstName',
      errorId: 'RegistrationFirstNameError',
      label: 'First Name',
      autocomplete: 'given-name',
    })
    var lastName = createNameRow({
      rowId: 'registration-last-name-row',
      inputId: 'RegistrationLastName',
      errorId: 'RegistrationLastNameError',
      label: 'Last Name',
      autocomplete: 'family-name',
    })

    emailRow.parentNode.insertBefore(firstName.row, emailRow)
    emailRow.parentNode.insertBefore(lastName.row, emailRow)

    var pending = readPendingProfile()
    if (pending) {
      firstName.input.value = pending.firstName.trim()
      lastName.input.value = pending.lastName.trim()
    }

    firstName.input.addEventListener('blur', function () {
      setValidation(firstName)
    })
    lastName.input.addEventListener('blur', function () {
      setValidation(lastName)
    })

    firstName.input.addEventListener('input', function () {
      if (firstName.input.getAttribute('aria-invalid') === 'true') setValidation(firstName)
    })
    lastName.input.addEventListener('input', function () {
      if (lastName.input.getAttribute('aria-invalid') === 'true') setValidation(lastName)
    })

    form.addEventListener('invalid', function (event) {
      if (event.target !== firstName.input && event.target !== lastName.input) return

      event.preventDefault()
      var firstNameIsValid = setValidation(firstName)
      var lastNameIsValid = setValidation(lastName)
      if (!firstNameIsValid) firstName.input.focus()
      else if (!lastNameIsValid) lastName.input.focus()
    }, true)

    form.addEventListener('submit', function (event) {
      var firstNameIsValid = setValidation(firstName)
      var lastNameIsValid = setValidation(lastName)

      if (!firstNameIsValid || !lastNameIsValid) {
        event.preventDefault()
        if (!firstNameIsValid) firstName.input.focus()
        else lastName.input.focus()
        return
      }

      var usernameInput = document.getElementById('UsernameTextBox')
      var payload = {
        version: PAYLOAD_VERSION,
        firstName: firstName.input.value.trim(),
        lastName: lastName.input.value.trim(),
        email: emailInput.value.trim(),
        username: usernameInput ? usernameInput.value.trim() : '',
        createdAt: Date.now(),
      }

      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch (_error) {
        // Power Pages still owns and may complete the native registration post.
      }
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true })
  } else {
    initialize()
  }
})()

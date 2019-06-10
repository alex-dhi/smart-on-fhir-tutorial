(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });

        $.when(pt, obv).fail(onError);

        $.when(pt, obv).done(function(patient, obv) {
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;

          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  window.getConditions = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {

        var con_promise = smart.patient.api.fetchAll({
          type: 'Condition',
          query: {}
        });
        
        $.when(con_promise).fail(onError);

        $.when(con_promise).done(function(con_bundle) {
          // extract conditions
          let con_array = [];

          con_bundle.forEach(function(con) {
            if (con.verificationStatus == 'confirmed'
              || con.verificationStatus == 'differential'
              || con.verificationStatus == 'refuted'
            ) {
              let con_obj = defaultCondition();
              con_obj.category = con.category.text;
              if (con.code.coding) {
                con_obj.system = con.code.coding[0].system;
                con_obj.code = con.code.coding[0].code;
              }
              con_obj.display = con.code.text;

              if (con.clinicalStatus) {
                con_obj.clinicalStatus = con.clinicalStatus;
              }
              con_array.push(con_obj);
            }
          });
          ret.resolve(con_array);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();
  };

  window.getMedOrders = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {

        var med_promise = smart.patient.api.fetchAll({
          type: 'MedicationOrder',
          query: {}
        });
        
        $.when(med_promise).fail(onError);

        $.when(med_promise).done(function(med_bundle) {
          // extract conditions
          let med_array = [];

          med_bundle.forEach(function(med) {
            let med_obj = defaultMedication();
            if (med.status) {
              med_obj.status = med.status;
            }
            if (med.dateWritten) {
              med_obj.dateWritten = med.dateWritten.substring(0,10);
            }
            if (med.dosageInstruction.length > 0 && med.dosageInstruction[0].doseQuantity) {
              med_obj.doseQuantity = med.dosageInstruction[0].doseQuantity;
            }
            if (med.medicationCodeableConcept) {
              if (med.medicationCodeableConcept.coding) {
                med_obj.system = med.medicationCodeableConcept.coding[0].system;
                med_obj.code = med.medicationCodeableConcept.coding[0].code;
              }
              med_obj.display = med.medicationCodeableConcept.text;
              med_array.push(med_obj);
            } else if (med.contained) { // combo meds
              // assuming top-level meds is first element
              let code = med.contained[0].code;
              if (code.coding) {
                med_obj.system = code.coding[0].system;
                med_obj.code = code.coding[0].code;
              }
              med_obj.display = code.text;
              med_array.push(med_obj);

              // go thru ingredients if present
              for(let j=1; j < med.contained.length; j++) {
                let ingredient_obj = defaultMedication();
                // reset dose quantity, which is only associated with top-level meds
                ingredient_obj.status = med_obj.status;
                ingredient_obj.dateWritten = med_obj.dateWritten;

                let code = med.contained[j].code;
                if (code.coding) {
                  ingredient_obj.system = code.coding[0].system;
                  ingredient_obj.code = code.coding[0].code;
                }
                ingredient_obj.display = code.text;
                med_array.push(ingredient_obj);
              }
            }

          });
          ret.resolve(med_array);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();
  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
    };
  }

  function defaultCondition(){
    return {
      category: '',
      display: '',
      system: '',
      code: '',
      clinicalStatus: ''
    };
  }

  function defaultMedication(){
    return {
      doseQuantity: {value: '', unit: ''},
      display: '',
      system: '',
      code: '',
      status: '',
      dateWritten: ''
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawObservation = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
  };

  window.drawCondition = function(conditions) {
    // build conditions table
    let tbl_html = '<table id="table-conditions" class="table table-striped table-bordered table-sm" cellspacing="0" width="90%">'
          + '<thead><tr><th>Category</th><th>Condition</th><th>Codeset</th><th>Code</th><th>Clinical Status</th></tr></thead><tbody>';
    for (let i=0; i < conditions.length; i++) {
      let con = conditions[i];
      tbl_html += "<tr><td>" + con.category + "</td><td>" + con.display + "</td><td>" 
                  + con.system + "</td><td>" + con.code + "</td><td>" + con.clinicalStatus + "</td></tr>";
    }
    tbl_html += "</tbody></table>";
    $('#div-conditions').html(tbl_html);

    $('#table-conditions').DataTable();
    $('.dataTables_length').addClass('bs-select');
    $('#btn-con').show();
  };

  window.drawMedication = function(meds) {
    // build meds table
    let tbl_html = '<table id="table-medications" class="table table-striped table-bordered table-sm" cellspacing="0" width="90%">'
          + '<thead><tr><th>Medication</th><th>Dose Quantity</th><th>Status</th><th>Codeset</th><th>Code</th></tr></thead><tbody>';
    for (let i=0; i < meds.length; i++) {
      let med = meds[i];
      tbl_html += "<tr><td>" + med.display + "</td><td>" + med.doseQuantity.value + ' ' + med.doseQuantity.unit + "</td><td>" 
                  + med.status + "</td><td>" + med.system + "</td><td>" + med.code + "</td></tr>";
    }
    tbl_html += "</tbody></table>";
    $('#div-medications').hide();
    $('#div-medications').html(tbl_html);

    $('#table-medications').DataTable();
    $('.dataTables_length').addClass('bs-select');
    $('#btn-med').show();
  };

  window.toggleTables = function(tbl_to_show) {
    let tables = ['observations','conditions','medications'];
    for (let i=0; i < tables.length; i++) {
      if (tables[i] == tbl_to_show) {
        $('#div-' + tables[i]).show();
      } else {
        $('#div-' + tables[i]).hide();
      }
    }
  }

})(window);
